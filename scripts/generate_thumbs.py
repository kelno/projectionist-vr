#!/usr/bin/env python3
"""Generate a JPEG thumbnail for every library video that does not have one yet."""

from __future__ import annotations

import argparse
import configparser
import os
from pathlib import Path
import subprocess
import sys

from common import is_video_file


# Seconds into the video of the thumbnail frame, past most intros and fades.
THUMBNAIL_SEEK_SECONDS = "20"
# Keep the left eye of a side-by-side video, 512 pixels wide.
THUMBNAIL_FILTER = "crop=in_w/2:in_h:0:0,scale=512:-1"


def load_library_paths(config_path: Path) -> tuple[Path, Path]:
    """Read the videos and thumbnails directories from the [library] section."""
    config = configparser.ConfigParser()
    if not config.read(config_path):
        raise FileNotFoundError(f"Configuration file not found: {config_path}")
    if "library" not in config:
        raise ValueError("Configuration must contain a [library] section.")
    library = config["library"]
    for option in ("videos_path", "thumbnails_path"):
        if not library.get(option):
            raise ValueError(f"Missing required [library] value: {option}")
    return Path(library["videos_path"]), Path(library["thumbnails_path"])


def generate_thumbnail(video_file: Path, thumb_file: Path) -> bool:
    """Write one thumbnail through a temporary file, and return whether it was created.

    The temporary file keeps an interrupted run from leaving a truncated thumbnail
    that later runs would treat as done.
    """
    partial_file = thumb_file.with_name(f"{thumb_file.stem}.partial.jpg")
    result = subprocess.run(
        [
            "ffmpeg",
            "-loglevel", "error",
            "-nostdin",
            "-ss", THUMBNAIL_SEEK_SECONDS,
            "-i", str(video_file),
            "-filter:v", THUMBNAIL_FILTER,
            "-frames:v", "1",
            "-q:v", "2",
            "-y",
            str(partial_file),
        ],
        check=False,
    )
    # ffmpeg exits successfully without writing anything when the seek is past
    # the end of the video, so the output file is the real success test.
    if result.returncode != 0 or not partial_file.is_file():
        partial_file.unlink(missing_ok=True)
        return False
    partial_file.replace(thumb_file)
    return True


def generate_thumbnails(videos_path: Path, thumbnails_path: Path) -> list[Path]:
    """Generate the missing thumbnails, mirroring the video tree, and return the videos that failed."""
    if not videos_path.is_dir():
        raise FileNotFoundError(f"Videos directory not found: {videos_path}")

    failed: list[Path] = []
    created = 0
    for dirpath, _, filenames in os.walk(videos_path):
        thumb_dir = thumbnails_path / Path(dirpath).relative_to(videos_path)
        for filename in filenames:
            if not is_video_file(filename):
                continue
            video_file = Path(dirpath) / filename
            thumb_file = (thumb_dir / filename).with_suffix(".jpg")
            if thumb_file.exists():
                continue
            thumb_dir.mkdir(parents=True, exist_ok=True)
            print(f"Generating thumbnail for: {video_file}")
            if generate_thumbnail(video_file, thumb_file):
                created += 1
            else:
                print(f"ERROR: no thumbnail generated for: {video_file}", file=sys.stderr)
                failed.append(video_file)
    print(f"Created {created} thumbnails, {len(failed)} failed")
    return failed


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("config", type=Path, help="Path to config.ini")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        videos_path, thumbnails_path = load_library_paths(args.config)
        failed = generate_thumbnails(videos_path, thumbnails_path)
    except (OSError, ValueError) as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 1
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
