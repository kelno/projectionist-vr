import hashlib
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import library_store
from library_store import SAMPLE_BYTES, LibraryStore, compute_fingerprint, iter_videos


def fingerprint_of(path: Path) -> str:
    return compute_fingerprint(path, path.stat().st_size)


class FingerprintTests(unittest.TestCase):
    def test_a_small_file_is_hashed_whole(self):
        with tempfile.TemporaryDirectory() as directory:
            video = Path(directory) / "small.mp4"
            video.write_bytes(b"abc")
            self.assertEqual(fingerprint_of(video), f"3-{hashlib.blake2b(b'abc', digest_size=8).hexdigest()}")

    def test_a_large_file_is_known_by_its_size_and_its_ends(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            content = bytearray(os.urandom(3 * SAMPLE_BYTES))
            video = root / "large.mp4"
            video.write_bytes(content)
            fingerprint = fingerprint_of(video)
            self.assertTrue(fingerprint.startswith(f"{3 * SAMPLE_BYTES:x}-"))

            # The middle megabyte is never read.
            content[SAMPLE_BYTES + 10] ^= 0xFF
            video.write_bytes(content)
            self.assertEqual(fingerprint_of(video), fingerprint)

            content[-1] ^= 0xFF
            video.write_bytes(content)
            self.assertNotEqual(fingerprint_of(video), fingerprint)

    def test_the_same_content_at_two_paths_has_the_same_fingerprint(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            content = os.urandom(2 * SAMPLE_BYTES + 5)
            (root / "a.mp4").write_bytes(content)
            (root / "b.mkv").write_bytes(content)
            self.assertEqual(fingerprint_of(root / "a.mp4"), fingerprint_of(root / "b.mkv"))


class FingerprintCacheTests(unittest.TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.root = Path(directory.name)
        self.video = self.root / "videos" / "clip.mp4"
        self.video.parent.mkdir()
        self.video.write_bytes(b"clip")
        self.store_dir = self.root / "thumbnails"

    def fingerprint_in_new_run(self):
        """Fingerprint the video as a new run of a script would, and return the fingerprint and how many files were read."""
        store = LibraryStore(self.store_dir)
        with mock.patch("library_store.compute_fingerprint", wraps=library_store.compute_fingerprint) as compute:
            fingerprint = store.fingerprint(self.video, Path("clip.mp4"))
        store.save()
        return fingerprint, compute.call_count

    def test_an_unchanged_file_is_not_read_again(self):
        first, reads = self.fingerprint_in_new_run()
        self.assertEqual(reads, 1)
        self.assertEqual(self.fingerprint_in_new_run(), (first, 0))

    def test_a_new_modification_time_means_reading_again(self):
        first, _ = self.fingerprint_in_new_run()
        stat = self.video.stat()
        os.utime(self.video, (stat.st_atime, stat.st_mtime + 10))
        self.assertEqual(self.fingerprint_in_new_run(), (first, 1))

    def test_a_new_size_means_reading_again(self):
        first, _ = self.fingerprint_in_new_run()
        stat = self.video.stat()
        self.video.write_bytes(b"longer clip")
        os.utime(self.video, (stat.st_atime, stat.st_mtime))
        fingerprint, reads = self.fingerprint_in_new_run()
        self.assertEqual(reads, 1)
        self.assertNotEqual(fingerprint, first)

    def test_an_unreadable_cache_starts_over(self):
        self.store_dir.mkdir()
        (self.store_dir / "fingerprints.json").write_text("not json", encoding="utf-8")
        with mock.patch("sys.stderr"):
            self.assertEqual(self.fingerprint_in_new_run()[1], 1)


class IterVideosTests(unittest.TestCase):
    def test_lists_videos_only_relative_to_the_library(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "B").mkdir()
            (root / "A").mkdir()
            for name in ("B/two.MKV", "A/one.mp4", "A/notes.txt", "root.webm"):
                (root / name).touch()
            self.assertEqual(list(iter_videos(root)), [Path("root.webm"), Path("A/one.mp4"), Path("B/two.MKV")])


if __name__ == "__main__":
    unittest.main()
