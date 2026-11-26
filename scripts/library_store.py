"""Find the library's videos, and keep what is computed from them by content rather than by path.

A video is known by its fingerprint: its size and a hash of its first and last
megabyte. Its thumbnail and media info are stored under that fingerprint, so
they follow the file when it is moved or renamed, and so do the seek bar's
thumbnails (generate_seek_thumbs.py). Only those two megabytes are
read because the library can sit on a cloud mount, where reading a whole file
downloads it.

The store is the thumbnails directory, kept flat:
- `<fingerprint>.jpg`: the thumbnail of each video content;
- `<fingerprint>.seek.jpg`: the seek bar's thumbnails of each video content,
  in a grid;
- `media.json`: the media info ffprobe gave for each fingerprint;
- `seek.json`: for each fingerprint with seek thumbnails, the seconds between
  them, the grid's columns, how many there are, and the layout they were cut
  for (`cut_for`, from video_format.py);
- `thumbnails.json`: for each fingerprint, the layout its thumbnail was cut
  for. A thumbnail or seek image cut for another layout than the one guessed
  now, as after a rename that adds a layout marker, is made again;
- `fingerprints.json`: for each video path relative to the library, the size,
  modification time and fingerprint computed for it, so that a later run reads
  nothing from a file whose size and modification time haven't changed.
"""

from __future__ import annotations

import hashlib
import json
import os
import sys
import time
from collections.abc import Iterator
from pathlib import Path

VIDEO_EXTENSIONS = (".mp4", ".mkv", ".avi", ".mov", ".webm")
# How much of each end of a video the fingerprint reads.
SAMPLE_BYTES = 1024 * 1024
MEDIA_FILE_NAME = "media.json"
SEEK_FILE_NAME = "seek.json"
# A `.partial.jpg` file younger than this may be one another run is writing: pruning leaves it.
PARTIAL_FILE_GRACE_SECONDS = 24 * 3600
FINGERPRINTS_FILE_NAME = "fingerprints.json"
THUMBNAILS_FILE_NAME = "thumbnails.json"


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
    """Write JSON through a temporary file, so that a reader never sees a half-written file.

    The temporary file's name holds the process id, so that two runs writing
    the same file never share one.
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    partial_path = path.with_name(f"{path.name}.{os.getpid()}.partial")
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
        # Fingerprint -> {"interval", "columns", "count", "cut_for"} of its seek thumbnails.
        self.seek: dict[str, dict] = read_json_object(directory / SEEK_FILE_NAME)
        # Fingerprint -> the layout its thumbnail was cut for.
        self.thumbnail_layouts: dict[str, str] = read_json_object(directory / THUMBNAILS_FILE_NAME)
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

    def seek_path(self, fingerprint: str) -> Path:
        return self.directory / f"{fingerprint}.seek.jpg"

    def save(self) -> None:
        """Write the fingerprint cache, the media info and the thumbnails' layouts."""
        write_json_atomic(self.directory / FINGERPRINTS_FILE_NAME, dict(sorted(self.fingerprints.items())))
        write_json_atomic(self.directory / MEDIA_FILE_NAME, dict(sorted(self.media.items())))
        write_json_atomic(self.directory / THUMBNAILS_FILE_NAME, dict(sorted(self.thumbnail_layouts.items())))

    # The seek thumbnails are made by a run of hours, which a catalogue run
    # with --prune can overlap: rather than writing back what it read at its
    # start, each re-reads seek.json and changes only its own part, so neither
    # undoes the other's.

    def add_seek(self, fingerprint: str, layout: dict) -> None:
        """Record the layout of a fingerprint's new seek thumbnails in seek.json."""
        self.seek = read_json_object(self.directory / SEEK_FILE_NAME)
        self.seek[fingerprint] = layout
        write_json_atomic(self.directory / SEEK_FILE_NAME, dict(sorted(self.seek.items())))

    def remove_seek(self, keep: set[str]) -> None:
        """Remove from seek.json every fingerprint not in `keep`."""
        seek = read_json_object(self.directory / SEEK_FILE_NAME)
        self.seek = {fingerprint: layout for fingerprint, layout in seek.items() if fingerprint in keep}
        write_json_atomic(self.directory / SEEK_FILE_NAME, dict(sorted(self.seek.items())))

    def prune(self) -> dict[str, int]:
        """Delete the thumbnails, seek thumbnails, media info and cache entries of every video not seen in this run.

        Return how many of each were removed. Leftover `.partial.jpg` files from
        an interrupted run go too, once a day old. seek.json is written at once;
        the caller writes the rest with save(). Refuses when no video was seen,
        because that is more likely a missing mount than an empty library, and
        pruning then would delete the whole store.
        """
        if not self.seen:
            raise ValueError("No videos found, so nothing was pruned: is the library mounted?")
        used = set(self.seen.values())
        removed = {"thumbnails": 0, "seek": 0, "media": 0, "paths": 0}
        for path in self.directory.glob("*.jpg"):
            fingerprint = path.name.removesuffix(".jpg").removesuffix(".seek")
            if not path.is_file() or fingerprint in used:
                continue
            if path.name.endswith(".partial.jpg") and time.time() - path.stat().st_mtime < PARTIAL_FILE_GRACE_SECONDS:
                continue
            path.unlink()
            removed["seek" if ".seek." in path.name else "thumbnails"] += 1
        for fingerprint in [key for key in self.media if key not in used]:
            del self.media[fingerprint]
            removed["media"] += 1
        for fingerprint in [key for key in self.thumbnail_layouts if key not in used]:
            del self.thumbnail_layouts[fingerprint]
        self.remove_seek(used)
        for key in [key for key in self.fingerprints if key not in self.seen]:
            del self.fingerprints[key]
            removed["paths"] += 1
        return removed
