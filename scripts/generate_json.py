#!/usr/bin/env python3
"""Generate the player catalogue inside the self-contained dist directory.

Each video's thumbnail and media info come from the store described in
library_store.py, by the video's fingerprint, so they follow a moved or
renamed video. FFprobe runs only for content the store has no media info for.

MP4s that keep their index after the video data start slowly in the browser
(mp4_layout.py): the media info records it as `faststart`, and the run ends by
listing them, to remux with remux_faststart.py.
"""

from __future__ import annotations

import argparse
import contextlib
import json
import subprocess
import sys
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from urllib.parse import quote

from library_store import LibraryStore, iter_videos, write_json_atomic
from mp4_layout import BOX_CONTAINER_SUFFIXES, needs_faststart
from settings import Settings, load_settings
from video_format import guess_screen_type

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_OUTPUT_PATH = PROJECT_ROOT / "dist" / "files.json"


def clean_filename(filename: str, prefixes: tuple[str, ...] = ()) -> str:
    """Turn a source filename into a readable library label, without the given prefixes."""
    for prefix in prefixes:
        if filename.startswith(prefix):
            filename = filename[len(prefix) :]
    filename = Path(filename).stem
    for old, new in {"+": " ", "_": " ", "__": " ", "  ": " "}.items():
        filename = filename.replace(old, new)
    return " ".join(part if part.lower() in {"4k", "1080p", "180", "6k", "1920p"} else part.title() for part in filename.split()).strip()


def get_file_timestamps(filepath: Path) -> dict[str, str]:
    """Return display and sorting timestamps for a source media file."""
    mtime = filepath.stat().st_mtime
    return {
        "date": datetime.fromtimestamp(mtime).strftime("%Y-%m-%d %H:%M:%S"),
        "epoch": str(mtime),
    }


def parse_media_info(probe: dict, size: int) -> dict[str, object]:
    """Pick what the player's media info page shows from ffprobe's JSON output."""
    streams = probe.get("streams", [])
    video = next((stream for stream in streams if stream.get("codec_type") == "video"), {})
    audio = next((stream for stream in streams if stream.get("codec_type") == "audio"), {})
    media: dict[str, object] = {"size": size}
    if video:
        media["width"] = video.get("width")
        media["height"] = video.get("height")
        media["video_codec"] = video.get("codec_name")
        numerator, _, denominator = str(video.get("avg_frame_rate", "0/1")).partition("/")
        with contextlib.suppress(ValueError, ZeroDivisionError):
            media["fps"] = round(float(numerator) / float(denominator or 1), 2)
    if audio:
        media["audio_codec"] = audio.get("codec_name")
        media["audio_channels"] = audio.get("channels")
    file_format = probe.get("format", {})
    for key, cast in (("duration", float), ("bit_rate", int)):
        with contextlib.suppress(KeyError, TypeError, ValueError):
            media[key] = cast(file_format[key])
    return {key: value for key, value in media.items() if value not in (None, "")}


def read_media_info(video_file: Path) -> dict[str, object] | None:
    """Return the video's resolution, codecs and the like from ffprobe, or None when it cannot tell."""
    try:
        result = subprocess.run(
            [
                "ffprobe",
                "-loglevel",
                "error",
                "-show_entries",
                "stream=codec_type,codec_name,width,height,avg_frame_rate,channels:format=duration,bit_rate",
                "-output_format",
                "json",
                str(video_file),
            ],
            capture_output=True,
            text=True,
            check=False,
        )
        probe = json.loads(result.stdout)
    except (OSError, ValueError):
        return None
    if result.returncode != 0:
        return None
    return parse_media_info(probe, video_file.stat().st_size)


def media_from_store(store: LibraryStore, fingerprint: str, video_path: Path, probe_media: bool) -> dict[str, object] | None:
    """Return the media info stored for this content, or probe the video and store it.

    Probing reads the file's header, which over a network mount is slow, so it
    only happens for content seen for the first time, and not at all without
    probe_media.
    """
    media = store.media.get(fingerprint)
    if media is None and probe_media:
        media = read_media_info(video_path)
        if media:
            store.media[fingerprint] = media
    return media


def check_faststart(video_path: Path, media: dict[str, object] | None) -> bool | None:
    """Return whether the video keeps its index before the video data, or None when that doesn't apply or can't be read.

    The answer is kept in the stored media info, when there is one: it follows
    the content, like the rest, so each video is read once.
    """
    if video_path.suffix.lower() not in BOX_CONTAINER_SUFFIXES:
        return None
    if media is not None and "faststart" in media:
        return bool(media["faststart"])
    try:
        faststart = not needs_faststart(video_path)
    except (OSError, ValueError) as error:
        print(f"WARNING: cannot tell where {video_path} keeps its index: {error}", file=sys.stderr)
        return None
    if media is not None:
        media["faststart"] = faststart
    return faststart


def url_for_file(prefix: str, relative_path: Path) -> str:
    """Join a configured URL prefix to a safely escaped library-relative path."""
    if not prefix.startswith("/"):
        raise ValueError(f"URL prefix must start with '/': {prefix}")
    return f"{prefix.rstrip('/')}/{quote(relative_path.as_posix(), safe='/')}"


def join_url_prefix(site_prefix: str, route_prefix: str) -> str:
    """Put a media route under the player site path, including root sites."""
    if not site_prefix.startswith("/") or not route_prefix.startswith("/"):
        raise ValueError("URL prefixes must start with '/'.")
    site = site_prefix.rstrip("/")
    route = route_prefix.rstrip("/")
    return f"{site}{route}" or "/"


def url_prefixes(settings: Settings) -> tuple[str, str]:
    """Return the full URL prefixes of the videos and of the thumbnails, under the site path."""
    return (
        join_url_prefix(settings.site_url_prefix, settings.videos_url_prefix),
        join_url_prefix(settings.site_url_prefix, settings.thumbnails_url_prefix),
    )


def generate_category_entries(
    settings: Settings,
    store: LibraryStore,
    probe_media: bool = True,
    slow_start: list[Path] | None = None,
) -> dict[str, list[dict]]:
    """Build category entries using media roots and server URL prefixes only.

    Thumbnails and media info come from the store, which gains the media info
    of newly probed videos and the fingerprints of new or changed files. The
    MP4s that start slowly are added to `slow_start`, if given.
    """
    videos_dir = settings.videos_path
    videos_url_prefix, thumbnails_url_prefix = url_prefixes(settings)
    if not videos_dir.is_dir():
        raise FileNotFoundError(f"Videos directory not found: {videos_dir}")

    category_map: dict[str, list[dict]] = defaultdict(list)
    for relative_path in iter_videos(videos_dir):
        video_path = videos_dir / relative_path
        entry: dict[str, object] = {
            "name": clean_filename(relative_path.name, settings.name_prefixes),
            "src": url_for_file(videos_url_prefix, relative_path),
            "thumbnail": "",
            "screen_type": guess_screen_type(relative_path.name),
            **get_file_timestamps(video_path),
        }
        try:
            fingerprint = store.fingerprint(video_path, relative_path)
        except OSError as error:
            print(f"WARNING: cannot read {video_path}, listed without thumbnail or media info: {error}", file=sys.stderr)
        else:
            if store.thumbnail_path(fingerprint).exists():
                entry["thumbnail"] = url_for_file(thumbnails_url_prefix, Path(f"{fingerprint}.jpg"))
            media = media_from_store(store, fingerprint, video_path, probe_media)
            faststart = check_faststart(video_path, media)
            if faststart is False and slow_start is not None:
                slow_start.append(video_path)
            if media:
                entry["media"] = media
                entry["screen_type"] = guess_screen_type(relative_path.name, media.get("width"), media.get("height"))
                if entry["screen_type"] == "screen" and media.get("width") and media.get("height"):
                    # A flat screen takes the video's proportions.
                    entry["frame_width"], entry["frame_height"] = media["width"], media["height"]
            elif faststart is not None:
                entry["media"] = {"faststart": faststart}
        category_map[relative_path.parent.name or "!Uncategorized"].append(entry)
    return category_map


def write_catalogue(category_map: dict[str, list[dict]], output_path: Path) -> int:
    """Write sorted catalogue data and return the number of video entries."""
    video_data = {
        "videos": [
            {"name": category, "list": sorted(entries, key=lambda item: float(item["epoch"]), reverse=True)}
            for category, entries in sorted(category_map.items())
        ]
    }
    write_json_atomic(output_path, video_data, indent=4)
    return sum(len(category["list"]) for category in video_data["videos"])


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("config", type=Path, help="Path to config.toml")
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT_PATH,
        help=f"Catalogue output path (default: {DEFAULT_OUTPUT_PATH})",
    )
    parser.add_argument(
        "--no-media-info",
        action="store_true",
        help="Don't run ffprobe; media info already in the store is still used",
    )
    parser.add_argument(
        "--prune",
        action="store_true",
        help="Delete the stored thumbnails and media info that no current video uses",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        settings = load_settings(args.config)
        store = LibraryStore(settings.thumbnails_path)
        try:
            slow_start: list[Path] = []
            category_map = generate_category_entries(settings, store, probe_media=not args.no_media_info, slow_start=slow_start)
            if args.prune:
                removed = store.prune()
                print(f"Pruned {removed['thumbnails']} thumbnails, {removed['media']} media info entries and {removed['paths']} cached fingerprints")
        finally:
            # Keep the fingerprints and media info gathered so far, even after an error or an interruption.
            store.save()
        video_count = write_catalogue(category_map, args.output)
    except (OSError, ValueError) as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 1
    print(f"files.json created at {args.output.resolve()}")
    print(f"Found {len(category_map)} categories with {video_count} total videos")
    if slow_start:
        print(
            f"WARNING: {len(slow_start)} videos keep their index at the end, so they start slowly."
            " Remux them with: python scripts/remux_faststart.py <folder> --recursive --apply",
            file=sys.stderr,
        )
        for path in slow_start:
            print(f"  {path}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
