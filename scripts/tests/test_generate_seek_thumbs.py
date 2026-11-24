import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from generate_json import generate_category_entries
from generate_seek_thumbs import generate_seek_thumbnails, seek_interval, seek_layout, tile_height
from library_store import LibraryStore
from settings import Settings


def fake_ffmpeg(duration="95.0", size=(5760, 2880), unreadable=()):
    """Stand in for subprocess.run: ffprobe prints the duration and frame size, ffmpeg writes its output file (the last argument).

    Frames asked at a time in `unreadable` (as ffmpeg's -ss text) aren't written.
    """

    def run(command, check, **kwargs):
        if command[0] == "ffprobe":
            probe = {"format": {"duration": duration}, "streams": [{"width": size[0], "height": size[1]}]}
            return subprocess.CompletedProcess(command, 0, stdout=json.dumps(probe), stderr="")
        if "-ss" in command and command[command.index("-ss") + 1] in unreadable:
            return subprocess.CompletedProcess(command, 1)
        Path(command[-1]).write_bytes(b"image")
        return subprocess.CompletedProcess(command, 0)

    return run


def frame_times(run):
    """Return the times the mocked subprocess.run asked ffmpeg for a frame at."""
    return [call.args[0][call.args[0].index("-ss") + 1] for call in run.call_args_list if "-ss" in call.args[0]]


def tile_commands(run):
    return [call.args[0] for call in run.call_args_list if "-framerate" in call.args[0]]


class LayoutTests(unittest.TestCase):
    def test_the_interval_is_a_fortieth_of_the_duration_rounded_up_to_a_step(self):
        for duration, interval in ((60, 10), (400, 10), (401, 15), (800, 20), (1200, 30), (1201, 60), (7200, 60)):
            self.assertEqual(seek_interval(duration), interval, duration)

    def test_a_very_long_video_gets_whole_minutes_past_600_frames(self):
        self.assertEqual(seek_interval(11 * 3600), 120)

    def test_the_grid_is_about_square(self):
        self.assertEqual(seek_layout(95), {"interval": 10, "columns": 4, "count": 10})
        self.assertEqual(seek_layout(7200), {"interval": 60, "columns": 11, "count": 120})
        self.assertEqual(seek_layout(3), {"interval": 10, "columns": 1, "count": 1})

    def test_a_tile_shows_what_one_eye_sees(self):
        self.assertEqual(tile_height("sbs", 5760, 2880), 160)
        self.assertEqual(tile_height("tb", 2880, 5760), 160)
        self.assertEqual(tile_height("360", 4096, 4096), 80)
        self.assertEqual(tile_height("screen", 1920, 1080), 90)


class GenerateTests(unittest.TestCase):
    def make_library(self, root: Path) -> tuple[Path, Path]:
        videos = root / "videos"
        (videos / "Music").mkdir(parents=True)
        (videos / "Music" / "clip.mp4").write_bytes(b"clip")
        return videos, root / "thumbnails"

    def test_takes_each_frame_in_the_middle_of_its_seconds_and_skips_done_videos(self):
        with tempfile.TemporaryDirectory() as directory:
            videos, thumbnails = self.make_library(Path(directory))
            with mock.patch("generate_seek_thumbs.subprocess.run", side_effect=fake_ffmpeg()) as run:
                self.assertEqual(generate_seek_thumbnails(videos, thumbnails), [])
                self.assertEqual(generate_seek_thumbnails(videos, thumbnails), [])
            self.assertEqual(frame_times(run), ["5.000", "15.000", *[f"{seconds}.000" for seconds in range(25, 95, 10)], "92.500"])
            [tile] = tile_commands(run)
            self.assertEqual(tile[tile.index("-filter:v") + 1], "tile=4x3")
            store = LibraryStore(thumbnails)
            [fingerprint] = store.seek
            self.assertEqual(store.seek[fingerprint], {"interval": 10, "columns": 4, "count": 10})
            self.assertTrue(store.seek_path(fingerprint).is_file())
            self.assertEqual(list(thumbnails.glob("*.partial.jpg")), [])

    def test_an_unreadable_frame_repeats_the_one_before(self):
        with tempfile.TemporaryDirectory() as directory:
            videos, thumbnails = self.make_library(Path(directory))
            with mock.patch("generate_seek_thumbs.subprocess.run", side_effect=fake_ffmpeg(unreadable={"35.000"})):
                self.assertEqual(generate_seek_thumbnails(videos, thumbnails), [])
            self.assertEqual(len(LibraryStore(thumbnails).seek), 1)

    def test_a_video_whose_first_frame_is_unreadable_fails(self):
        with tempfile.TemporaryDirectory() as directory:
            videos, thumbnails = self.make_library(Path(directory))
            with mock.patch("generate_seek_thumbs.subprocess.run", side_effect=fake_ffmpeg(unreadable={"5.000"})) as run:
                self.assertEqual(generate_seek_thumbnails(videos, thumbnails), [videos / "Music" / "clip.mp4"])
            self.assertEqual(frame_times(run), ["5.000"])
            self.assertEqual(LibraryStore(thumbnails).seek, {})
            self.assertEqual(list(thumbnails.glob("*.jpg")), [])

    def test_a_video_of_unknown_duration_fails_without_running_ffmpeg(self):
        with tempfile.TemporaryDirectory() as directory:
            videos, thumbnails = self.make_library(Path(directory))
            with mock.patch("generate_seek_thumbs.subprocess.run", side_effect=fake_ffmpeg(duration="N/A")) as run:
                self.assertEqual(generate_seek_thumbnails(videos, thumbnails), [videos / "Music" / "clip.mp4"])
            self.assertEqual(frame_times(run), [])


class CatalogueTests(unittest.TestCase):
    def test_the_catalogue_lists_seek_thumbnails_that_exist(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            videos, thumbnails = root / "videos", root / "thumbnails"
            (videos / "Music").mkdir(parents=True)
            (videos / "Music" / "clip.mp4").write_bytes(b"clip")
            (videos / "Music" / "other.mp4").write_bytes(b"other")
            with mock.patch("generate_seek_thumbs.subprocess.run", side_effect=fake_ffmpeg()):
                generate_seek_thumbnails(videos, thumbnails)
            store = LibraryStore(thumbnails)
            fingerprint, other = (store.fingerprint(videos / "Music" / name, Path("Music", name)) for name in ("clip.mp4", "other.mp4"))
            store.seek_path(other).unlink()

            settings = Settings(videos_path=videos, thumbnails_path=thumbnails, site_url_prefix="/vr-player")
            entries = {entry["src"].rsplit("/", 1)[1]: entry for entry in generate_category_entries(settings, store, probe_media=False)["Music"]}
            self.assertEqual(
                entries["clip.mp4"]["seek_thumbnails"],
                {"url": f"/vr-player/thumbnails/{fingerprint}.seek.jpg", "interval": 10, "columns": 4, "count": 10},
            )
            self.assertNotIn("seek_thumbnails", entries["other.mp4"])


if __name__ == "__main__":
    unittest.main()
