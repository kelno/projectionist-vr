from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from generate_thumbs import generate_thumbnails


def fake_ffmpeg(writes_output):
    """Stand in for subprocess.run, writing the output file (the last argument) when asked."""

    def run(command, check):
        if writes_output:
            Path(command[-1]).write_bytes(b"jpeg")
        return subprocess.CompletedProcess(command, 0)

    return run


class GenerateThumbnailsTests(unittest.TestCase):
    def make_library(self, root):
        videos = root / "videos"
        (videos / "Music").mkdir(parents=True)
        (videos / "Music" / "clip.mp4").write_bytes(b"")
        (videos / "notes.txt").write_bytes(b"")
        return videos, root / "thumbnails"

    def test_mirrors_the_video_tree_and_skips_existing_thumbnails(self):
        with tempfile.TemporaryDirectory() as directory:
            videos, thumbnails = self.make_library(Path(directory))
            with mock.patch("generate_thumbs.subprocess.run", side_effect=fake_ffmpeg(True)) as run:
                self.assertEqual(generate_thumbnails(videos, thumbnails), [])
                self.assertEqual(generate_thumbnails(videos, thumbnails), [])
            self.assertEqual(run.call_count, 1)
            self.assertEqual(sorted(p.name for p in thumbnails.rglob("*") if p.is_file()), ["clip.jpg"])

    def test_reports_a_video_for_which_ffmpeg_wrote_nothing(self):
        with tempfile.TemporaryDirectory() as directory:
            videos, thumbnails = self.make_library(Path(directory))
            with mock.patch("generate_thumbs.subprocess.run", side_effect=fake_ffmpeg(False)):
                failed = generate_thumbnails(videos, thumbnails)
            self.assertEqual(failed, [videos / "Music" / "clip.mp4"])
            self.assertEqual([p for p in thumbnails.rglob("*") if p.is_file()], [])


if __name__ == "__main__":
    unittest.main()
