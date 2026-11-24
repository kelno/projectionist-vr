import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from transcode_av1 import build_command, find_files, is_temporary, output_path, temporary_path


def info(audio_codecs, pix_fmt="yuv420p"):
    streams = [
        {"index": 0, "codec_type": "video", "codec_name": "mjpeg", "disposition": {"attached_pic": 1}},
        {"index": 1, "codec_type": "video", "codec_name": "av1", "pix_fmt": pix_fmt, "disposition": {"attached_pic": 0}},
    ]
    streams += [{"index": 2 + i, "codec_type": "audio", "codec_name": codec} for i, codec in enumerate(audio_codecs)]
    return {"streams": streams, "format": {"duration": "4.0"}}


class TranscodeAv1Tests(unittest.TestCase):
    def test_temporary_path_is_recognised_as_temporary(self):
        source = Path("library") / "clip.mkv"
        self.assertEqual(temporary_path(source).name, ".clip.av1-hevc-tmp.mp4")
        self.assertTrue(is_temporary(temporary_path(source)))
        self.assertFalse(is_temporary(source))

    def test_output_is_mp4_beside_source(self):
        self.assertEqual(output_path(Path("a") / "clip.webm"), Path("a") / "clip.mp4")
        self.assertEqual(output_path(Path("a") / "clip.mp4"), Path("a") / "clip.mp4")

    def test_finds_videos_and_leftovers_recursively(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "sub").mkdir()
            (root / "sub" / "clip.MKV").touch()
            (root / "notes.txt").touch()
            temporary_path(root / "sub" / "other.mp4").touch()
            videos, leftovers = find_files(root)
            self.assertEqual([path.name for path in videos], ["clip.MKV"])
            self.assertEqual([path.name for path in leftovers], [".other.av1-hevc-tmp.mp4"])

    def test_copies_mp4_compatible_audio_and_skips_cover_art(self):
        command = build_command(Path("in.mkv"), Path("out.mp4"), info(["opus", "aac"]), "ffmpeg", 20, "medium")
        self.assertIn("0:1", command)
        self.assertEqual(command[command.index("-c:a") + 1], "copy")
        self.assertEqual(command[command.index("-pix_fmt") + 1], "yuv420p")

    def test_reencodes_incompatible_audio_and_keeps_ten_bit(self):
        command = build_command(Path("in.webm"), Path("out.mp4"), info(["vorbis"], "yuv420p10le"), "ffmpeg", 20, "medium")
        self.assertEqual(command[command.index("-c:a") + 1], "aac")
        self.assertEqual(command[command.index("-pix_fmt") + 1], "yuv420p10le")


if __name__ == "__main__":
    unittest.main()
