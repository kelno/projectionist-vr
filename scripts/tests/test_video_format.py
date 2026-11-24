import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from video_format import guess_screen_type


class GuessScreenTypeTests(unittest.TestCase):
    def test_the_name_says_the_layout(self):
        self.assertEqual(guess_screen_type("beach_LR_180.mp4", 3840, 3840), "sbs")
        self.assertEqual(guess_screen_type("beach_TB.mp4"), "tb")
        self.assertEqual(guess_screen_type("beach-3dv.mp4"), "tb")
        self.assertEqual(guess_screen_type("beach 360 TB.mp4"), "360")
        self.assertEqual(guess_screen_type("beach_2D.mp4", 3840, 1920), "screen")

    def test_markers_are_whole_words(self):
        # "tb" inside a word, "360" inside a number: no marker.
        self.assertEqual(guess_screen_type("stbernard_13600.mp4", 3840, 1920), "sbs")

    def test_without_a_marker_the_frame_decides(self):
        self.assertEqual(guess_screen_type("beach.mp4", 5760, 2880), "sbs")
        self.assertEqual(guess_screen_type("beach.mp4", 2880, 5760), "tb")
        self.assertEqual(guess_screen_type("beach.mp4", 4096, 4096), "360")
        self.assertEqual(guess_screen_type("beach.mp4", 1920, 1080), "screen")

    def test_otherwise_side_by_side(self):
        self.assertEqual(guess_screen_type("beach.mp4"), "sbs")
        self.assertEqual(guess_screen_type("beach.mp4", 1000, 3000), "sbs")
        self.assertEqual(guess_screen_type("beach.mp4", "wide", None), "sbs")


if __name__ == "__main__":
    unittest.main()
