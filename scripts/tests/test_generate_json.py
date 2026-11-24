import configparser
import json
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from generate_json import generate_category_entries, join_url_prefix, url_for_file, write_catalogue


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
            (thumbnails / "Category").mkdir(parents=True)
            (videos / "Category" / "VR test.mp4").touch()
            (thumbnails / "Category" / "VR test.jpg").touch()
            config = configparser.ConfigParser()
            config["library"] = {
                "videos_path": str(videos),
                "thumbnails_path": str(thumbnails),
            }
            config["web"] = {
                "site_url_prefix": "/vr-player",
                "videos_url_prefix": "/media",
                "thumbnails_url_prefix": "/thumbnails",
            }

            categories = generate_category_entries(config)
            entry = categories["Category"][0]
            self.assertEqual(entry["src"], "/vr-player/media/Category/VR%20test.mp4")
            self.assertEqual(entry["thumbnail"], "/vr-player/thumbnails/Category/VR%20test.jpg")

    def test_writes_catalogue_to_requested_release_directory(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "dist" / "files.json"
            count = write_catalogue({"!Uncategorized": []}, output)
            self.assertEqual(count, 0)
            self.assertEqual(json.loads(output.read_text(encoding="utf-8")), {"videos": [{"name": "!Uncategorized", "list": []}]})


class MediaInfoTests(unittest.TestCase):
    PROBE = {
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

    def test_reuses_media_info_of_an_unchanged_file_only(self):
        from generate_json import media_for

        with tempfile.TemporaryDirectory() as directory:
            video = Path(directory) / "video.mp4"
            video.write_bytes(b"12345")
            previous = {"epoch": "1", "media": {"size": 5, "video_codec": "hevc"}}
            self.assertEqual(media_for(video, previous, "1"), previous["media"])
            # A new date, or a new size, means the file changed: it is probed
            # again, and this one isn't a video, so there is nothing to show.
            self.assertIsNone(media_for(video, previous, "2"))
            self.assertIsNone(media_for(video, {"epoch": "1", "media": {"size": 6}}, "1"))

    def test_reads_previous_media_by_source(self):
        from generate_json import load_previous_media

        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "files.json"
            output.write_text(json.dumps({"videos": [{"name": "C", "list": [
                {"src": "/a.mp4", "epoch": "1", "media": {"size": 5}},
                {"src": "/b.mp4", "epoch": "1"},
            ]}]}), encoding="utf-8")
            self.assertEqual(list(load_previous_media(output)), ["/a.mp4"])
            self.assertEqual(load_previous_media(Path(directory) / "missing.json"), {})

    def test_probes_a_real_video(self):
        import shutil
        import subprocess

        from generate_json import read_media_info

        if not (shutil.which("ffmpeg") and shutil.which("ffprobe")):
            self.skipTest("FFmpeg is not installed")
        with tempfile.TemporaryDirectory() as directory:
            video = Path(directory) / "test.mp4"
            subprocess.run(
                ["ffmpeg", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc=size=320x160:rate=30:duration=1",
                 "-pix_fmt", "yuv420p", str(video)],
                check=True,
            )
            media = read_media_info(video)
            self.assertEqual((media["width"], media["height"], media["video_codec"], media["fps"]), (320, 160, "h264", 30.0))
