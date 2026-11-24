import json
import struct
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from typing import Any, ClassVar

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from unittest import mock

from generate_json import clean_filename, generate_category_entries, join_url_prefix, url_for_file, write_catalogue
from generate_thumbs import generate_thumbnails
from library_store import LibraryStore
from settings import Settings


def make_config(videos: Path, thumbnails: Path) -> Settings:
    return Settings(videos_path=videos, thumbnails_path=thumbnails, site_url_prefix="/vr-player")


def fake_ffmpeg(command, check, **kwargs):
    """Stand in for subprocess.run in generate_thumbs: ffprobe gives a duration, ffmpeg writes its output file."""
    if command[0] == "ffprobe":
        return subprocess.CompletedProcess(command, 0, stdout='{"format": {"duration": "60.0"}}', stderr="")
    Path(command[-1]).write_bytes(b"jpeg")
    return subprocess.CompletedProcess(command, 0)


class GenerateCatalogueTests(unittest.TestCase):
    def test_url_for_file_uses_url_prefix_not_project_path(self):
        self.assertEqual(
            url_for_file("/media", Path("New folder/video #1.mp4")),
            "/media/New%20folder/video%20%231.mp4",
        )

    def test_url_for_file_rejects_relative_prefix(self):
        with self.assertRaises(ValueError):
            url_for_file("media", Path("video.mp4"))

    def test_joins_media_route_under_site_subpath(self):
        self.assertEqual(join_url_prefix("/vr-player", "/media"), "/vr-player/media")
        self.assertEqual(join_url_prefix("/", "/media"), "/media")

    def test_generates_media_and_thumbnail_urls_from_configured_roots(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            videos = root / "unrelated-video-location"
            thumbnails = root / "thumbnail-location"
            (videos / "Category").mkdir(parents=True)
            thumbnails.mkdir()
            (videos / "Category" / "VR test.mp4").write_bytes(b"video")
            (videos / "Other.mp4").write_bytes(b"other video")
            store = LibraryStore(thumbnails)
            fingerprint = store.fingerprint(videos / "Category" / "VR test.mp4", Path("Category/VR test.mp4"))
            store.thumbnail_path(fingerprint).touch()

            categories = generate_category_entries(make_config(videos, thumbnails), store, probe_media=False)
            entry = categories["Category"][0]
            self.assertEqual(entry["src"], "/vr-player/media/Category/VR%20test.mp4")
            self.assertEqual(entry["thumbnail"], f"/vr-player/thumbnails/{fingerprint}.jpg")
            # A video without a thumbnail in the store gets none.
            self.assertEqual(categories["!Uncategorized"][0]["thumbnail"], "")

    def test_guesses_each_layout_and_gives_a_flat_video_its_proportions(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            videos, thumbnails = root / "videos", root / "thumbnails"
            (videos / "Clips").mkdir(parents=True)
            thumbnails.mkdir()
            sizes = {"wide.mp4": (5760, 2880), "flat.mp4": (1920, 1080), "beach_TB.mp4": (5760, 2880), "unknown.mp4": None}
            for name in sizes:
                (videos / "Clips" / name).write_bytes(name.encode())

            def media_of(path: Path):
                size = sizes[path.name]
                return {"width": size[0], "height": size[1]} if size else None

            with mock.patch("generate_json.read_media_info", side_effect=media_of):
                categories = generate_category_entries(make_config(videos, thumbnails), LibraryStore(thumbnails))
            entries = {Path(entry["src"]).name: entry for entry in categories["Clips"]}
            self.assertEqual(
                {name: entry["screen_type"] for name, entry in entries.items()},
                {"wide.mp4": "sbs", "flat.mp4": "screen", "beach_TB.mp4": "tb", "unknown.mp4": "sbs"},
            )
            self.assertEqual((entries["flat.mp4"]["frame_width"], entries["flat.mp4"]["frame_height"]), (1920, 1080))
            self.assertNotIn("frame_width", entries["wide.mp4"])

    def test_writes_catalogue_to_requested_release_directory(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "dist" / "files.json"
            count = write_catalogue({"!Uncategorized": []}, output)
            self.assertEqual(count, 0)
            self.assertEqual(json.loads(output.read_text(encoding="utf-8")), {"videos": [{"name": "!Uncategorized", "list": []}]})


class NameTests(unittest.TestCase):
    def test_a_name_loses_its_extension_and_separators(self):
        self.assertEqual(clean_filename("my_holiday+trip 4k.mp4"), "My Holiday Trip 4k")

    def test_configured_prefixes_are_cut(self):
        prefixes = ("Studio - ", "Site.com_")
        self.assertEqual(clean_filename("Studio - beach day.mp4", prefixes), "Beach Day")
        self.assertEqual(clean_filename("Site.com_beach_day.mp4", prefixes), "Beach Day")

    def test_no_prefix_is_cut_unless_configured(self):
        self.assertEqual(clean_filename("Studio - beach day.mp4"), "Studio - Beach Day")


class StoreTests(unittest.TestCase):
    """The thumbnail and catalogue scripts together, as a server runs them: thumbnails first, then the catalogue."""

    MEDIA: ClassVar[dict[str, object]] = {"size": 5, "video_codec": "hevc"}

    def run_both(self, videos: Path, thumbnails: Path, prune: bool = False):
        """Run the thumbnail script, then the catalogue, and return the catalogue and the mocks counting the work done."""
        with mock.patch("generate_thumbs.subprocess.run", side_effect=fake_ffmpeg) as ffmpeg:
            self.assertEqual(generate_thumbnails(videos, thumbnails), [])
        store = LibraryStore(thumbnails)
        with mock.patch("generate_json.read_media_info", return_value=dict(self.MEDIA)) as probe:
            categories = generate_category_entries(make_config(videos, thumbnails), store)
        removed = store.prune() if prune else None
        store.save()
        store.save_seek()
        return categories, ffmpeg, probe, removed

    def make_library(self, root: Path) -> tuple[Path, Path]:
        videos = root / "videos"
        (videos / "Old").mkdir(parents=True)
        (videos / "New").mkdir()
        (videos / "Old" / "clip.mp4").write_bytes(b"clip content")
        (videos / "Old" / "other.mp4").write_bytes(b"other content")
        return videos, root / "thumbnails"

    def test_a_moved_video_keeps_its_thumbnail_and_media_without_new_work(self):
        with tempfile.TemporaryDirectory() as directory:
            videos, thumbnails = self.make_library(Path(directory))
            before, ffmpeg, probe, _ = self.run_both(videos, thumbnails)
            self.assertEqual((ffmpeg.call_count, probe.call_count), (4, 2))  # ffprobe and ffmpeg for each video

            (videos / "Old" / "clip.mp4").rename(videos / "New" / "renamed clip.mp4")
            after, ffmpeg, probe, _ = self.run_both(videos, thumbnails)
            self.assertEqual((ffmpeg.call_count, probe.call_count), (0, 0))
            old_entry = next(entry for entry in before["Old"] if entry["src"].endswith("/clip.mp4"))
            new_entry = after["New"][0]
            self.assertEqual(new_entry["src"], "/vr-player/media/New/renamed%20clip.mp4")
            self.assertEqual(new_entry["thumbnail"], old_entry["thumbnail"])
            self.assertEqual(new_entry["media"], self.MEDIA)

    def test_without_probing_the_stored_media_info_is_still_used(self):
        with tempfile.TemporaryDirectory() as directory:
            videos, thumbnails = self.make_library(Path(directory))
            self.run_both(videos, thumbnails)
            with mock.patch("generate_json.read_media_info") as probe:
                categories = generate_category_entries(make_config(videos, thumbnails), LibraryStore(thumbnails), probe_media=False)
            probe.assert_not_called()
            self.assertEqual([entry["media"] for entry in categories["Old"]], [self.MEDIA, self.MEDIA])

    def test_prune_removes_only_what_no_current_video_uses(self):
        with tempfile.TemporaryDirectory() as directory:
            videos, thumbnails = self.make_library(Path(directory))
            self.run_both(videos, thumbnails)
            store = LibraryStore(thumbnails)
            for cached in store.fingerprints.values():
                store.seek_path(cached["fingerprint"]).write_bytes(b"jpeg")
                store.seek[cached["fingerprint"]] = {"interval": 10, "columns": 1, "count": 1}
            store.save_seek()
            kept = store.fingerprints["Old/clip.mp4"]["fingerprint"]
            (videos / "Old" / "other.mp4").unlink()
            (thumbnails / "leftover.partial.jpg").write_bytes(b"half")

            _, _, _, removed = self.run_both(videos, thumbnails, prune=True)
            self.assertEqual(removed, {"thumbnails": 2, "seek": 1, "media": 1, "paths": 1})
            self.assertEqual(sorted(path.name for path in thumbnails.glob("*.jpg")), [f"{kept}.jpg", f"{kept}.seek.jpg"])
            store = LibraryStore(thumbnails)
            self.assertEqual(list(store.media), [kept])
            self.assertEqual(list(store.seek), [kept])
            self.assertEqual(list(store.fingerprints), ["Old/clip.mp4"])

    def test_prune_refuses_when_no_video_is_found(self):
        with tempfile.TemporaryDirectory() as directory:
            videos, thumbnails = self.make_library(Path(directory))
            self.run_both(videos, thumbnails)
            for video in videos.rglob("*.mp4"):
                video.unlink()
            store = LibraryStore(thumbnails)
            generate_category_entries(make_config(videos, thumbnails), store)
            with self.assertRaises(ValueError):
                store.prune()
            self.assertEqual(len(list(thumbnails.glob("*.jpg"))), 2)


def box(box_type: bytes, payload: bytes = b"") -> bytes:
    return struct.pack(">I4s", len(payload) + 8, box_type) + payload


class FaststartTests(unittest.TestCase):
    """MP4s that keep their index after the video data are flagged in the media info and listed."""

    def make_library(self, root: Path) -> tuple[Path, Path]:
        videos = root / "videos"
        (videos / "Clips").mkdir(parents=True)
        (videos / "Clips" / "ready.mp4").write_bytes(box(b"ftyp") + box(b"moov") + box(b"mdat", b"ready"))
        (videos / "Clips" / "late.mp4").write_bytes(box(b"ftyp") + box(b"mdat", b"late") + box(b"moov"))
        (videos / "Clips" / "film.mkv").write_bytes(b"matroska")
        return videos, root / "thumbnails"

    def run_generator(self, videos: Path, thumbnails: Path, probe_media: bool = True):
        store = LibraryStore(thumbnails)
        slow: list[Path] = []
        with mock.patch("generate_json.read_media_info", side_effect=lambda path: {"size": path.stat().st_size}):
            categories = generate_category_entries(make_config(videos, thumbnails), store, probe_media, slow)
        store.save()
        media: dict[str, Any] = {Path(entry["src"]).name: entry.get("media") for entry in categories["Clips"]}
        return media, slow

    def test_flags_and_lists_the_videos_that_start_slowly(self):
        with tempfile.TemporaryDirectory() as directory:
            videos, thumbnails = self.make_library(Path(directory))
            media, slow = self.run_generator(videos, thumbnails)
            self.assertTrue(media["ready.mp4"]["faststart"])
            self.assertFalse(media["late.mp4"]["faststart"])
            self.assertNotIn("faststart", media["film.mkv"])
            self.assertEqual(slow, [videos / "Clips" / "late.mp4"])

    def test_the_answer_is_stored_with_the_media_info(self):
        with tempfile.TemporaryDirectory() as directory:
            videos, thumbnails = self.make_library(Path(directory))
            self.run_generator(videos, thumbnails)
            with mock.patch("generate_json.needs_faststart") as check:
                media, slow = self.run_generator(videos, thumbnails)
            check.assert_not_called()
            self.assertFalse(media["late.mp4"]["faststart"])
            self.assertEqual(len(slow), 1)

    def test_without_probing_the_check_still_runs(self):
        with tempfile.TemporaryDirectory() as directory:
            videos, thumbnails = self.make_library(Path(directory))
            media, slow = self.run_generator(videos, thumbnails, probe_media=False)
            self.assertEqual(media["late.mp4"], {"faststart": False})
            self.assertIsNone(media["film.mkv"])
            self.assertEqual(len(slow), 1)


class MediaInfoTests(unittest.TestCase):
    PROBE: ClassVar[dict[str, Any]] = {
        "streams": [
            {"codec_type": "video", "codec_name": "hevc", "width": 5760, "height": 2880, "avg_frame_rate": "60000/1001"},
            {"codec_type": "audio", "codec_name": "aac", "channels": 2},
        ],
        "format": {"duration": "120.5", "bit_rate": "38000000"},
    }

    def test_parses_resolution_codecs_and_rates(self):
        from generate_json import parse_media_info

        self.assertEqual(
            parse_media_info(self.PROBE, 4200),
            {
                "size": 4200,
                "width": 5760,
                "height": 2880,
                "video_codec": "hevc",
                "fps": 59.94,
                "audio_codec": "aac",
                "audio_channels": 2,
                "duration": 120.5,
                "bit_rate": 38000000,
            },
        )

    def test_a_video_without_audio_has_no_audio_fields(self):
        from generate_json import parse_media_info

        probe = {"streams": [self.PROBE["streams"][0]], "format": {}}
        media = parse_media_info(probe, 10)
        self.assertNotIn("audio_codec", media)
        self.assertNotIn("bit_rate", media)

    def test_probes_a_real_video(self):
        import shutil
        import subprocess

        from generate_json import read_media_info

        if not (shutil.which("ffmpeg") and shutil.which("ffprobe")):
            self.skipTest("FFmpeg is not installed")
        with tempfile.TemporaryDirectory() as directory:
            video = Path(directory) / "test.mp4"
            subprocess.run(
                ["ffmpeg", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc=size=320x160:rate=30:duration=1", "-pix_fmt", "yuv420p", str(video)],
                check=True,
            )
            media = read_media_info(video)
            assert media is not None
            self.assertEqual((media["width"], media["height"], media["video_codec"], media["fps"]), (320, 160, "h264", 30.0))
