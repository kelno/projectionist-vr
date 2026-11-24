import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from settings import load_settings

EXAMPLE = Path(__file__).resolve().parent.parent.parent / "config.toml.example"


class SettingsTests(unittest.TestCase):
    def load(self, text: str):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "config.toml"
            path.write_text(text, encoding="utf-8")
            return load_settings(path)

    def test_reads_every_setting(self):
        settings = self.load(
            """
            [library]
            videos_path = "/videos"
            thumbnails_path = 'D:\\thumbnails'
            name_prefixes = ["Studio - ", "Site.com_"]

            [web]
            site_url_prefix = "/vr-player"
            videos_url_prefix = "/files"
            """
        )
        self.assertEqual(settings.videos_path, Path("/videos"))
        self.assertEqual(settings.thumbnails_path, Path("D:\\thumbnails"))
        self.assertEqual(settings.name_prefixes, ("Studio - ", "Site.com_"))
        self.assertEqual((settings.site_url_prefix, settings.videos_url_prefix, settings.thumbnails_url_prefix), ("/vr-player", "/files", "/thumbnails"))

    def test_web_and_prefixes_have_defaults(self):
        settings = self.load('[library]\nvideos_path = "/v"\nthumbnails_path = "/t"\n')
        self.assertEqual(settings.name_prefixes, ())
        self.assertEqual(settings.site_url_prefix, "/")

    def test_the_library_paths_are_required(self):
        with self.assertRaisesRegex(ValueError, "thumbnails_path"):
            self.load('[library]\nvideos_path = "/v"\n')
        with self.assertRaisesRegex(ValueError, r"\[library\]"):
            self.load('[web]\nsite_url_prefix = "/"\n')

    def test_prefixes_must_be_a_list_of_text(self):
        with self.assertRaisesRegex(ValueError, "name_prefixes"):
            self.load('[library]\nvideos_path = "/v"\nthumbnails_path = "/t"\nname_prefixes = "Studio - "\n')

    def test_a_missing_file_says_which(self):
        with self.assertRaisesRegex(FileNotFoundError, "nowhere.toml"):
            load_settings(Path("nowhere.toml"))

    def test_the_example_is_valid(self):
        settings = load_settings(EXAMPLE)
        self.assertEqual(settings.site_url_prefix, "/vr-player")


if __name__ == "__main__":
    unittest.main()
