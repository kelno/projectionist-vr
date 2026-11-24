#!/usr/bin/env python3
"""Generate the seek bar's thumbnails: for every library video, one image of small frames taken every few seconds.

Hovering the player's seek bar shows the frame nearest the time pointed at.
A video gets a frame every duration / 40 seconds, rounded up to 10, 15, 20,
30 or 60 seconds: at most 40 frames for a video under 40 minutes, and one a
minute for a longer one. Each frame is the keyframe just before its time, which ffmpeg
reaches with a short read near that time instead of decoding the whole video:
the library can sit on a cloud mount, where reading a whole file downloads it.

The image is stored by the video's fingerprint, as `<fingerprint>.seek.jpg`,
with its layout in `seek.json` (library_store.py); generate_json.py lists the
ones that exist in the catalogue. A first run over a large library takes
hours on a small server: run it after generate_json.py, so that new videos
show in the library without waiting for it.
"""

from __future__ import annotations

import argparse
import math
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from generate_thumbs import EYE_SHARE, eye_filter, read_frame
from library_store import LibraryStore, iter_videos
from settings import load_settings
from video_format import guess_screen_type

# The seconds between frames to choose from: the first that gives at most FRAMES_PER_VIDEO frames.
INTERVALS = (10, 15, 20, 30, 60)
FRAMES_PER_VIDEO = 40
# Past this many frames (a video of 10 hours), the interval grows by whole minutes, so the image stays under 4096 pixels a side.
MAX_FRAMES = 600
TILE_WIDTH = 160


def seek_interval(duration: float) -> int:
    """Return the seconds between two frames of a video of this duration."""
    interval = next((step for step in INTERVALS if duration / step <= FRAMES_PER_VIDEO), INTERVALS[-1])
    if duration / interval > MAX_FRAMES:
        interval = 60 * math.ceil(duration / MAX_FRAMES / 60)
    return interval


def seek_layout(duration: float) -> dict[str, int]:
    """Return the seconds between frames, the grid's columns and the frame count for a video of this duration.

    Frame i covers the seconds from i * interval to the next frame; the grid is
    about square, filled row by row.
    """
    interval = seek_interval(duration)
    count = max(1, math.ceil(duration / interval))
    return {"interval": interval, "columns": math.ceil(math.sqrt(count)), "count": count}


def tile_height(layout: str, width: int, height: int) -> int:
    """Return the height of a frame TILE_WIDTH pixels wide showing what one eye sees, in even pixels."""
    width_share, height_share = EYE_SHARE[layout]
    eye_ratio = (height / height_share) / (width / width_share)
    return max(2, round(TILE_WIDTH * eye_ratio / 2) * 2)


def grab_frame(video_file: Path, seconds: float, video_filter: str, frame_file: Path) -> bool:
    """Write the keyframe at or before `seconds`, filtered, to frame_file, and return whether it was written."""
    result = subprocess.run(
        [
            "ffmpeg",
            "-loglevel",
            "error",
            "-nostdin",
            "-noaccurate_seek",
            "-ss",
            f"{seconds:.3f}",
            "-i",
            str(video_file),
            "-filter:v",
            video_filter,
            "-frames:v",
            "1",
            "-y",
            str(frame_file),
        ],
        check=False,
    )
    return result.returncode == 0 and frame_file.is_file()


def generate_seek_image(video_file: Path, seek_file: Path) -> dict[str, int] | None:
    """Write the video's seek thumbnails to seek_file through a temporary file, and return their layout.

    Return None when the video's duration or frame size is unknown, or when
    fewer than half of the frames could be read. A frame that can't be read
    repeats the one before it.
    """
    duration, width, height = read_frame(video_file)
    if duration is None or width is None or height is None:
        print(f"ERROR: unknown duration or frame size: {video_file}", file=sys.stderr)
        return None
    layout = seek_layout(duration)
    interval, count = layout["interval"], layout["count"]
    screen_type = guess_screen_type(video_file.name, width, height)
    video_filter = f"{eye_filter(screen_type)}scale={TILE_WIDTH}:{tile_height(screen_type, width, height)}"
    partial_file = seek_file.with_name(f"{seek_file.stem}.partial.jpg")

    with tempfile.TemporaryDirectory() as directory:
        frames = Path(directory)
        missed = 0
        for index in range(count):
            # The middle of the seconds this frame covers.
            seconds = (index * interval + min((index + 1) * interval, duration)) / 2
            frame_file = frames / f"{index:04d}.bmp"
            if grab_frame(video_file, seconds, video_filter, frame_file):
                continue
            missed += 1
            if index == 0 or missed * 2 > count:
                print(f"ERROR: cannot read the frame at {seconds:g} s: {video_file}", file=sys.stderr)
                return None
            shutil.copyfile(frames / f"{index - 1:04d}.bmp", frame_file)
        rows = math.ceil(count / layout["columns"])
        result = subprocess.run(
            [
                "ffmpeg",
                "-loglevel",
                "error",
                "-nostdin",
                "-framerate",
                "1",
                "-i",
                str(frames / "%04d.bmp"),
                "-filter:v",
                f"tile={layout['columns']}x{rows}",
                "-frames:v",
                "1",
                "-q:v",
                "4",
                "-y",
                str(partial_file),
            ],
            check=False,
        )
    if result.returncode != 0 or not partial_file.is_file():
        partial_file.unlink(missing_ok=True)
        print(f"ERROR: cannot assemble the seek thumbnails: {video_file}", file=sys.stderr)
        return None
    partial_file.replace(seek_file)
    return layout


def generate_seek_thumbnails(videos_path: Path, thumbnails_path: Path) -> list[Path]:
    """Generate the missing seek thumbnails into the store, and return the videos that failed.

    The layouts are saved after each video, so that an interrupted run keeps
    what it made.
    """
    if not videos_path.is_dir():
        raise FileNotFoundError(f"Videos directory not found: {videos_path}")

    store = LibraryStore(thumbnails_path)
    failed: list[Path] = []
    created = 0
    for relative_path in iter_videos(videos_path):
        video_file = videos_path / relative_path
        try:
            fingerprint = store.fingerprint(video_file, relative_path)
        except OSError as error:
            print(f"ERROR: cannot read {video_file}: {error}", file=sys.stderr)
            failed.append(video_file)
            continue
        seek_file = store.seek_path(fingerprint)
        if fingerprint in store.seek and seek_file.exists():
            continue
        thumbnails_path.mkdir(parents=True, exist_ok=True)
        print(f"Generating seek thumbnails for: {video_file}")
        layout = generate_seek_image(video_file, seek_file)
        if layout is None:
            failed.append(video_file)
            continue
        store.seek[fingerprint] = layout
        store.save_seek()
        created += 1
    print(f"Created seek thumbnails for {created} videos, {len(failed)} failed")
    return failed


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("config", type=Path, help="Path to config.toml")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        settings = load_settings(args.config)
        failed = generate_seek_thumbnails(settings.videos_path, settings.thumbnails_path)
    except (OSError, ValueError) as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 1
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
