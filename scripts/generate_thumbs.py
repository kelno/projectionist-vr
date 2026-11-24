#!/usr/bin/env python3
"""Generate a JPEG thumbnail for every library video that does not have one yet.

Thumbnails are named by the video's fingerprint, in the store described in
library_store.py, so a moved or renamed video keeps its thumbnail.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

from library_store import LibraryStore, iter_videos
from settings import load_settings
from video_format import guess_screen_type

# Seconds into the video of the thumbnail frame, past most intros and fades.
THUMBNAIL_SEEK_SECONDS = 20.0
# For a video too short for that, the fraction of its duration to take the frame at instead.
SHORT_VIDEO_SEEK_FRACTION = 0.5
THUMBNAIL_WIDTH = 512
# The part of the frame one eye sees, by layout (video_format.py): the frame's
# width and height are divided by these.
EYE_SHARE = {"sbs": (2, 1), "tb": (1, 2), "360": (1, 2), "screen": (1, 1)}


def eye_filter(layout: str) -> str:
    """Return the ffmpeg filter keeping the part of the frame one eye sees, or "" for a flat video."""
    width_share, height_share = EYE_SHARE[layout]
    if width_share == height_share == 1:
        return ""
    width = "in_w" if width_share == 1 else f"in_w/{width_share}"
    height = "in_h" if height_share == 1 else f"in_h/{height_share}"
    return f"crop={width}:{height}:0:0,"


def read_frame(video_file: Path) -> tuple[float | None, int | None, int | None]:
    """Return the video's duration in seconds and its frame's width and height, from its header.

    Each is None when ffprobe cannot tell.
    """
    result = subprocess.run(
        [
            "ffprobe",
            "-loglevel",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            "format=duration:stream=width,height",
            "-output_format",
            "json",
            str(video_file),
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    try:
        probe = json.loads(result.stdout)
    except ValueError:
        return None, None, None
    try:
        duration = float(probe.get("format", {}).get("duration"))
    except (TypeError, ValueError):
        duration = None
    streams = probe.get("streams") or [{}]
    width, height = streams[0].get("width"), streams[0].get("height")
    return (
        duration if duration and duration > 0 else None,
        width if isinstance(width, int) else None,
        height if isinstance(height, int) else None,
    )


def thumbnail_seek_seconds(duration: float | None) -> float:
    """Return where to take the thumbnail frame: THUMBNAIL_SEEK_SECONDS, or earlier in a shorter video.

    Without a duration, THUMBNAIL_SEEK_SECONDS is kept, so that a video ffmpeg
    cannot read still fails and gets reported.
    """
    if duration is None or duration > THUMBNAIL_SEEK_SECONDS:
        return THUMBNAIL_SEEK_SECONDS
    return duration * SHORT_VIDEO_SEEK_FRACTION


def generate_thumbnail(video_file: Path, thumb_file: Path) -> bool:
    """Write one thumbnail through a temporary file, and return whether it was created.

    The temporary file keeps an interrupted run from leaving a truncated thumbnail
    that later runs would treat as done.
    """
    partial_file = thumb_file.with_name(f"{thumb_file.stem}.partial.jpg")
    duration, width, height = read_frame(video_file)
    seek_seconds = thumbnail_seek_seconds(duration)
    layout = guess_screen_type(video_file.name, width, height)
    if duration is None:
        print(f"WARNING: unknown duration, taking the frame at {seek_seconds:g} s: {video_file}", file=sys.stderr)
    result = subprocess.run(
        [
            "ffmpeg",
            "-loglevel",
            "error",
            "-nostdin",
            "-ss",
            f"{seek_seconds:.3f}",
            "-i",
            str(video_file),
            "-filter:v",
            f"{eye_filter(layout)}scale={THUMBNAIL_WIDTH}:-1",
            "-frames:v",
            "1",
            "-q:v",
            "2",
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
    """Generate the missing thumbnails into the store, and return the videos that failed.

    Videos with the same content share one thumbnail. The fingerprint cache is
    saved even when the run is interrupted, so that the next run doesn't read
    again the files already fingerprinted.
    """
    if not videos_path.is_dir():
        raise FileNotFoundError(f"Videos directory not found: {videos_path}")

    store = LibraryStore(thumbnails_path)
    failed: list[Path] = []
    created = 0
    try:
        for relative_path in iter_videos(videos_path):
            video_file = videos_path / relative_path
            try:
                thumb_file = store.thumbnail_path(store.fingerprint(video_file, relative_path))
            except OSError as error:
                print(f"ERROR: cannot read {video_file}: {error}", file=sys.stderr)
                failed.append(video_file)
                continue
            if thumb_file.exists():
                continue
            thumbnails_path.mkdir(parents=True, exist_ok=True)
            print(f"Generating thumbnail for: {video_file}")
            if generate_thumbnail(video_file, thumb_file):
                created += 1
            else:
                print(f"ERROR: no thumbnail generated for: {video_file}", file=sys.stderr)
                failed.append(video_file)
    finally:
        store.save()
    print(f"Created {created} thumbnails, {len(failed)} failed")
    return failed


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("config", type=Path, help="Path to config.toml")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        settings = load_settings(args.config)
        failed = generate_thumbnails(settings.videos_path, settings.thumbnails_path)
    except (OSError, ValueError) as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 1
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
