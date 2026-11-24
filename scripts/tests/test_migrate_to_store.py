import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from library_store import LibraryStore
from migrate_to_store import migrate


class MigrationTests(unittest.TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        root = Path(directory.name)
        self.videos = root / "videos"
        self.thumbnails = root / "thumbnails"
        self.config = root / "config.ini"
        self.catalogue = root / "files.json"
        self.config.write_text(
            f"[library]\nvideos_path={self.videos}\nthumbnails_path={self.thumbnails}\n"
            "[web]\nsite_url_prefix=/vr-player\nvideos_url_prefix=/media\nthumbnails_url_prefix=/thumbnails\n",
            encoding="utf-8",
        )
        # The old layout: each thumbnail mirrors its video's path.
        for name, content in (("Music/clip.mp4", b"clip"), ("Music/copy.mp4", b"clip"), ("top.mp4", b"top")):
            (self.videos / name).parent.mkdir(parents=True, exist_ok=True)
            (self.videos / name).write_bytes(content)
            (self.thumbnails / name).with_suffix(".jpg").parent.mkdir(parents=True, exist_ok=True)
            (self.thumbnails / name).with_suffix(".jpg").write_bytes(f"thumbnail of {name}".encode())
        (self.thumbnails / "Gone").mkdir()
        (self.thumbnails / "Gone" / "deleted video.jpg").write_bytes(b"orphan")
        clip_stat = (self.videos / "Music" / "clip.mp4").stat()
        self.catalogue.write_text(json.dumps({"videos": [{"name": "Music", "list": [
            {"src": "/vr-player/media/Music/clip.mp4", "epoch": str(clip_stat.st_mtime), "media": {"size": 4, "video_codec": "hevc"}},
            # Recorded before the file changed: its media info is not taken.
            {"src": "/vr-player/media/top.mp4", "epoch": "1", "media": {"size": 3, "video_codec": "av1"}},
        ]}]}), encoding="utf-8")

    def store_files(self) -> dict[str, bytes]:
        return {path.relative_to(self.thumbnails).as_posix(): path.read_bytes() for path in self.thumbnails.rglob("*") if path.is_file()}

    def test_moves_thumbnails_and_media_into_the_store(self):
        done = migrate(self.config, self.catalogue)
        self.assertEqual(done, {"moved": 2, "duplicates": 1, "media": 1, "folders": 1})

        store = LibraryStore(self.thumbnails)
        clip = store.fingerprints["Music/clip.mp4"]["fingerprint"]
        top = store.fingerprints["top.mp4"]["fingerprint"]
        self.assertEqual(store.fingerprints["Music/copy.mp4"]["fingerprint"], clip)
        self.assertEqual(store.thumbnail_path(clip).read_bytes(), b"thumbnail of Music/clip.mp4")
        self.assertEqual(store.thumbnail_path(top).read_bytes(), b"thumbnail of top.mp4")
        self.assertEqual(store.media, {clip: {"size": 4, "video_codec": "hevc"}})
        # The emptied Music folder is gone; the thumbnail of a deleted video stays for the owner to look at.
        self.assertFalse((self.thumbnails / "Music").exists())
        self.assertTrue((self.thumbnails / "Gone" / "deleted video.jpg").exists())

    def test_a_second_run_changes_nothing(self):
        migrate(self.config, self.catalogue)
        before = self.store_files()
        with mock.patch("library_store.compute_fingerprint") as compute:
            done = migrate(self.config, self.catalogue)
        compute.assert_not_called()
        self.assertEqual(done, {"moved": 0, "duplicates": 0, "media": 0, "folders": 0})
        self.assertEqual(self.store_files(), before)

    def test_works_without_the_old_catalogue(self):
        with mock.patch("sys.stderr"):
            done = migrate(self.config, self.catalogue.with_name("missing.json"))
        self.assertEqual((done["moved"], done["media"]), (2, 0))


if __name__ == "__main__":
    unittest.main()
