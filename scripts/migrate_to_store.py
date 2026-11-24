#!/usr/bin/env python3
# One-off: run once on the Pi to move to the fingerprint store, then delete this script from the repository.
"""Move thumbnails and media info from the old layout into the fingerprint store.

The old layout kept each thumbnail at the video's own relative path, under
the thumbnails directory, and the media info only in files.json. For each
video, this moves its old thumbnail to `<fingerprint>.jpg` and copies its
media info from the old catalogue into media.json, so that nothing has to be
generated or probed again. It then removes the category folders it emptied.

Running it again does nothing more: the moved thumbnails are no longer at
their old place, and media info already in the store is kept.
"""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import sys

from generate_json import DEFAULT_OUTPUT_PATH, load_config, url_for_file, url_prefixes
from library_store import LibraryStore, iter_videos


def load_old_media(catalogue_path: Path) -> dict[str, dict]:
    """Return the old catalogue's entries that have media info, by source URL, or nothing if it can't be read."""
    try:
        catalogue = json.loads(catalogue_path.read_text(encoding="utf-8"))
        return {
            entry["src"]: entry
            for category in catalogue["videos"]
            for entry in category["list"]
            if "media" in entry
        }
    except (OSError, ValueError, KeyError, TypeError) as error:
        print(f"WARNING: no media info taken from {catalogue_path} ({error}); generate_json.py will probe the videos again", file=sys.stderr)
        return {}


def old_media_still_valid(entry: dict, video_path: Path) -> bool:
    """Whether the old entry describes the file as it is now: same modification time and size."""
    stat = video_path.stat()
    return entry.get("epoch") == str(stat.st_mtime) and entry["media"].get("size") == stat.st_size


def remove_empty_folders(directory: Path) -> int:
    """Remove the empty folders under directory, deepest first, and return how many went."""
    removed = 0
    for dirpath, _, _ in os.walk(directory, topdown=False):
        folder = Path(dirpath)
        if folder != directory and not any(folder.iterdir()):
            folder.rmdir()
            removed += 1
    return removed


def migrate(config_path: Path, catalogue_path: Path) -> dict[str, int]:
    """Move the old thumbnails and media info into the store, and return what was done."""
    config = load_config(config_path)
    videos_dir = Path(config["library"]["videos_path"])
    thumbnails_dir = Path(config["library"]["thumbnails_path"])
    if not videos_dir.is_dir():
        raise FileNotFoundError(f"Videos directory not found: {videos_dir}")
    videos_url_prefix, _ = url_prefixes(config)
    old_media = load_old_media(catalogue_path)
    store = LibraryStore(thumbnails_dir)
    done = {"moved": 0, "duplicates": 0, "media": 0, "folders": 0}
    try:
        for relative_path in iter_videos(videos_dir):
            video_path = videos_dir / relative_path
            old_thumbnail = (thumbnails_dir / relative_path).with_suffix(".jpg")
            old_entry = old_media.get(url_for_file(videos_url_prefix, relative_path))
            if not old_thumbnail.is_file() and old_entry is None:
                continue
            fingerprint = store.fingerprint(video_path, relative_path)
            if old_thumbnail.is_file():
                new_thumbnail = store.thumbnail_path(fingerprint)
                if new_thumbnail.exists():
                    # Another copy of the same video already brought its thumbnail.
                    old_thumbnail.unlink()
                    done["duplicates"] += 1
                else:
                    old_thumbnail.replace(new_thumbnail)
                    done["moved"] += 1
            if old_entry is not None and fingerprint not in store.media and old_media_still_valid(old_entry, video_path):
                store.media[fingerprint] = old_entry["media"]
                done["media"] += 1
    finally:
        store.save()
    done["folders"] = remove_empty_folders(thumbnails_dir)
    return done


def report_leftovers(thumbnails_dir: Path) -> None:
    """List the files still in subfolders of the thumbnails directory: old thumbnails of videos that are gone."""
    leftovers = [path for path in thumbnails_dir.rglob("*") if path.is_file() and path.parent != thumbnails_dir]
    if leftovers:
        print(f"{len(leftovers)} files left in subfolders of {thumbnails_dir}, with no video to match; delete them by hand if they aren't needed:")
        for path in leftovers:
            print(f"  {path}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("config", type=Path, help="Path to config.ini")
    parser.add_argument(
        "--catalogue",
        type=Path,
        default=DEFAULT_OUTPUT_PATH,
        help=f"The old files.json, to take media info from (default: {DEFAULT_OUTPUT_PATH})",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        done = migrate(args.config, args.catalogue)
        report_leftovers(Path(load_config(args.config)["library"]["thumbnails_path"]))
    except (OSError, ValueError) as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 1
    print(
        f"Moved {done['moved']} thumbnails, removed {done['duplicates']} duplicates,"
        f" took media info for {done['media']} videos, removed {done['folders']} empty folders"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
