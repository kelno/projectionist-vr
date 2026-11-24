"""Find the library's videos, and keep what is computed from them by content rather than by path.

A video is known by its fingerprint: its size and a hash of its first and last
megabyte. Its thumbnail and media info are stored under that fingerprint, so
they follow the file when it is moved or renamed. Only those two megabytes are
read because the library can sit on a cloud mount, where reading a whole file
downloads it.

The store is the thumbnails directory, kept flat:
- `<fingerprint>.jpg`: the thumbnail of each video content;
- `media.json`: the media info ffprobe gave for each fingerprint;
- `fingerprints.json`: for each video path relative to the library, the size,
  modification time and fingerprint computed for it, so that a later run reads
  nothing from a file whose size and modification time haven't changed.
"""

from __future__ import annotations

from collections.abc import Iterator
import hashlib
import json
import os
from pathlib import Path
import sys


VIDEO_EXTENSIONS = (".mp4", ".mkv", ".avi", ".mov", ".webm")
# How much of each end of a video the fingerprint reads.
SAMPLE_BYTES = 1024 * 1024
MEDIA_FILE_NAME = "media.json"
FINGERPRINTS_FILE_NAME = "fingerprints.json"


def is_video_file(filename: str) -> bool:
    return filename.lower().endswith(VIDEO_EXTENSIONS)


def iter_videos(videos_dir: Path) -> Iterator[Path]:
    """Yield every video under videos_dir as a path relative to it, in a stable order."""
    for dirpath, dirnames, filenames in os.walk(videos_dir):
        dirnames.sort()
        for filename in sorted(filenames):
            if is_video_file(filename):
                yield (Path(dirpath) / filename).relative_to(videos_dir)


def compute_fingerprint(path: Path, size: int) -> str:
    """Return the file's size in hexadecimal and a hash of its first and last megabyte.

    A file of two megabytes or less is hashed whole.
    """
    digest = hashlib.blake2b(digest_size=8)
    with path.open("rb") as file:
        if size <= 2 * SAMPLE_BYTES:
            digest.update(file.read())
        else:
            digest.update(file.read(SAMPLE_BYTES))
            file.seek(size - SAMPLE_BYTES)
            digest.update(file.read(SAMPLE_BYTES))
    return f"{size:x}-{digest.hexdigest()}"


def read_json_object(path: Path) -> dict:
    """Return the JSON object in the file, or an empty one when the file is missing or unreadable."""
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return {}
    except (OSError, ValueError) as error:
        print(f"WARNING: ignoring unreadable {path}: {error}", file=sys.stderr)
        return {}
    return data if isinstance(data, dict) else {}


def write_json_atomic(path: Path, data: object, indent: int = 1) -> None:
    """Write JSON through a temporary file, so that a reader never sees a half-written file."""
    path.parent.mkdir(parents=True, exist_ok=True)
    partial_path = path.with_name(f"{path.name}.partial")
    partial_path.write_text(json.dumps(data, indent=indent, ensure_ascii=False), encoding="utf-8")
    partial_path.replace(path)


class LibraryStore:
    """The thumbnails directory, holding thumbnails and media info by fingerprint, and the fingerprint cache."""

    def __init__(self, directory: Path):
        self.directory = directory
        # Relative video path (with forward slashes) -> {"size", "mtime", "fingerprint"}.
        self.fingerprints: dict[str, dict] = read_json_object(directory / FINGERPRINTS_FILE_NAME)
        # Fingerprint -> the media info that generate_json.parse_media_info returns.
        self.media: dict[str, dict] = read_json_object(directory / MEDIA_FILE_NAME)
        # The videos fingerprinted during this run: relative path -> fingerprint.
        self.seen: dict[str, str] = {}

    def fingerprint(self, video_path: Path, relative_path: Path) -> str:
        """Return the video's fingerprint, reading the file only when its size or modification time changed."""
        key = relative_path.as_posix()
        stat = video_path.stat()
        cached = self.fingerprints.get(key)
        if cached and cached.get("size") == stat.st_size and cached.get("mtime") == stat.st_mtime:
            fingerprint = cached["fingerprint"]
        else:
            fingerprint = compute_fingerprint(video_path, stat.st_size)
            self.fingerprints[key] = {"size": stat.st_size, "mtime": stat.st_mtime, "fingerprint": fingerprint}
        self.seen[key] = fingerprint
        return fingerprint

    def thumbnail_path(self, fingerprint: str) -> Path:
        return self.directory / f"{fingerprint}.jpg"

    def save(self) -> None:
        """Write the fingerprint cache and the media info."""
        write_json_atomic(self.directory / FINGERPRINTS_FILE_NAME, dict(sorted(self.fingerprints.items())))
        write_json_atomic(self.directory / MEDIA_FILE_NAME, dict(sorted(self.media.items())))

    def prune(self) -> dict[str, int]:
        """Delete the thumbnails, media info and cache entries of every video not seen in this run.

        Return how many of each were removed. Leftover `.partial.jpg` files from
        an interrupted thumbnail go too. Refuses when no video was seen, because
        that is more likely a missing mount than an empty library, and pruning
        then would delete the whole store.
        """
        if not self.seen:
            raise ValueError("No videos found, so nothing was pruned: is the library mounted?")
        used = set(self.seen.values())
        removed = {"thumbnails": 0, "media": 0, "paths": 0}
        for path in self.directory.glob("*.jpg"):
            if path.is_file() and path.stem not in used:
                path.unlink()
                removed["thumbnails"] += 1
        for fingerprint in [key for key in self.media if key not in used]:
            del self.media[fingerprint]
            removed["media"] += 1
        for key in [key for key in self.fingerprints if key not in self.seen]:
            del self.fingerprints[key]
            removed["paths"] += 1
        return removed
