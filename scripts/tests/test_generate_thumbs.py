import json
import struct
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from generate_thumbs import THUMBNAIL_SEEK_SECONDS, generate_thumbnails, thumbnail_seek_seconds
from library_store import LibraryStore


def fake_ffmpeg(writes_output, duration="60.0", size=(5760, 2880)):
    """Stand in for subprocess.run: ffprobe prints the duration and frame size, ffmpeg writes its output file (the last argument) when asked."""

    def run(command, check, **kwargs):
        if command[0] == "ffprobe":
            probe = {"format": {"duration": duration}, "streams": [{"width": size[0], "height": size[1]}]}
            return subprocess.CompletedProcess(command, 0, stdout=json.dumps(probe), stderr="")
        if writes_output:
            Path(command[-1]).write_bytes(b"jpeg")
        return subprocess.CompletedProcess(command, 0)

    return run


def jpeg_header(width, height):
    """Return the start of a JPEG of this size, up to its frame header, which is all jpeg_size reads."""
    return b"\xff\xd8\xff\xc0" + struct.pack(">HBHH", 17, 8, height, width) + bytes(10)


def ffmpeg_calls(run):
    """Return the ffmpeg commands among the calls of the mocked subprocess.run."""
    return [call.args[0] for call in run.call_args_list if call.args[0][0] == "ffmpeg"]


class GenerateThumbnailsTests(unittest.TestCase):
    def make_library(self, root):
        videos = root / "videos"
        (videos / "Music").mkdir(parents=True)
        (videos / "Music" / "clip.mp4").write_bytes(b"")
        (videos / "notes.txt").write_bytes(b"")
        return videos, root / "thumbnails"

    def test_names_thumbnails_by_fingerprint_and_skips_existing_ones(self):
        with tempfile.TemporaryDirectory() as directory:
            videos, thumbnails = self.make_library(Path(directory))
            with mock.patch("generate_thumbs.subprocess.run", side_effect=fake_ffmpeg(True)) as run:
                self.assertEqual(generate_thumbnails(videos, thumbnails), [])
                self.assertEqual(generate_thumbnails(videos, thumbnails), [])
            self.assertEqual(len(ffmpeg_calls(run)), 1)
            fingerprint = LibraryStore(thumbnails).fingerprints["Music/clip.mp4"]["fingerprint"]
            self.assertEqual([p.name for p in thumbnails.rglob("*.jpg")], [f"{fingerprint}.jpg"])

    def test_videos_with_the_same_content_share_one_thumbnail(self):
        with tempfile.TemporaryDirectory() as directory:
            videos, thumbnails = self.make_library(Path(directory))
            (videos / "copy.mp4").write_bytes(b"")
            with mock.patch("generate_thumbs.subprocess.run", side_effect=fake_ffmpeg(True)) as run:
                self.assertEqual(generate_thumbnails(videos, thumbnails), [])
            self.assertEqual(len(ffmpeg_calls(run)), 1)

    def test_reports_a_video_for_which_ffmpeg_wrote_nothing(self):
        with tempfile.TemporaryDirectory() as directory:
            videos, thumbnails = self.make_library(Path(directory))
            with mock.patch("generate_thumbs.subprocess.run", side_effect=fake_ffmpeg(False)):
                failed = generate_thumbnails(videos, thumbnails)
            self.assertEqual(failed, [videos / "Music" / "clip.mp4"])
            self.assertEqual(list(thumbnails.rglob("*.jpg")), [])

    def store_frame_size(self, thumbnails, videos, relative, size):
        """Record the video's frame size in the media info, as generate_json.py does, and return its fingerprint."""
        store = LibraryStore(thumbnails)
        fingerprint = store.fingerprint(videos / relative, Path(relative))
        store.media[fingerprint] = {"width": size[0], "height": size[1]}
        store.save()
        return fingerprint

    def test_a_thumbnail_cut_for_another_layout_than_the_guess_is_made_again(self):
        with tempfile.TemporaryDirectory() as directory:
            videos, thumbnails = self.make_library(Path(directory))
            with mock.patch("generate_thumbs.subprocess.run", side_effect=fake_ffmpeg(True)) as run:
                generate_thumbnails(videos, thumbnails)
                fingerprint = self.store_frame_size(thumbnails, videos, "Music/clip.mp4", (5760, 2880))
                self.assertEqual(LibraryStore(thumbnails).thumbnail_layouts, {fingerprint: "sbs"})
                # Renamed with a top-bottom marker: same content, another layout.
                (videos / "Music" / "clip.mp4").rename(videos / "Music" / "clip_TB.mp4")
                generate_thumbnails(videos, thumbnails)
                generate_thumbnails(videos, thumbnails)
            self.assertEqual(len(ffmpeg_calls(run)), 2)
            self.assertEqual(LibraryStore(thumbnails).thumbnail_layouts, {fingerprint: "tb"})

    def test_a_thumbnail_from_before_layouts_were_recorded_is_judged_by_its_shape(self):
        for thumb_size, remade in (((512, 512), False), ((256, 512), True)):
            with self.subTest(thumb_size=thumb_size), tempfile.TemporaryDirectory() as directory:
                videos, thumbnails = self.make_library(Path(directory))
                fingerprint = self.store_frame_size(thumbnails, videos, "Music/clip.mp4", (5760, 2880))
                LibraryStore(thumbnails).thumbnail_path(fingerprint).write_bytes(jpeg_header(*thumb_size))
                with mock.patch("generate_thumbs.subprocess.run", side_effect=fake_ffmpeg(True)) as run:
                    generate_thumbnails(videos, thumbnails)
                self.assertEqual(len(ffmpeg_calls(run)), 1 if remade else 0)
                self.assertEqual(LibraryStore(thumbnails).thumbnail_layouts, {fingerprint: "sbs"})

    def test_takes_the_frame_halfway_through_a_short_video(self):
        with tempfile.TemporaryDirectory() as directory:
            videos, thumbnails = self.make_library(Path(directory))
            with mock.patch("generate_thumbs.subprocess.run", side_effect=fake_ffmpeg(True, duration="8.0")) as run:
                self.assertEqual(generate_thumbnails(videos, thumbnails), [])
            command = ffmpeg_calls(run)[0]
            self.assertEqual(command[command.index("-ss") + 1], "4.000")


class ThumbnailSeekTests(unittest.TestCase):
    def test_keeps_the_part_of_the_frame_one_eye_sees(self):
        for name, size, expected in (
            ("clip.mp4", (5760, 2880), "crop=in_w/2:in_h:0:0"),
            ("clip.mp4", (2880, 5760), "crop=in_w:in_h/2:0:0"),
            ("clip_360.mp4", (4096, 4096), "crop=in_w:in_h/2:0:0"),
            ("clip.mp4", (1920, 1080), "scale=512:-1"),
        ):
            with tempfile.TemporaryDirectory() as directory:
                videos = Path(directory) / "videos"
                (videos / "Music").mkdir(parents=True)
                (videos / "Music" / name).write_bytes(b"")
                with mock.patch("generate_thumbs.subprocess.run", side_effect=fake_ffmpeg(True, size=size)) as run:
                    generate_thumbnails(videos, Path(directory) / "thumbnails")
                command = ffmpeg_calls(run)[0]
                self.assertTrue(command[command.index("-filter:v") + 1].startswith(expected), (name, size))

    def test_long_video_keeps_the_usual_frame(self):
        self.assertEqual(thumbnail_seek_seconds(3600.0), THUMBNAIL_SEEK_SECONDS)

    def test_short_video_uses_its_middle(self):
        self.assertEqual(thumbnail_seek_seconds(10.0), 5.0)

    def test_unknown_duration_keeps_the_usual_frame(self):
        self.assertEqual(thumbnail_seek_seconds(None), THUMBNAIL_SEEK_SECONDS)


if __name__ == "__main__":
    unittest.main()
