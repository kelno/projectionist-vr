#!/usr/bin/env python3
"""Generate the player catalogue inside the self-contained dist directory."""

from __future__ import annotations

import argparse
import configparser
from collections import defaultdict
from datetime import datetime
import json
import os
from pathlib import Path
import subprocess
import sys
from urllib.parse import quote

from common import is_video_file


PROJECT_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_OUTPUT_PATH = PROJECT_ROOT / "dist" / "files.json"


def clean_filename(filename: str) -> str:
    """Turn a source filename into a readable library label."""
    prefixes = ("SpankBang.com_", "vrporncom_", "WankzVR - ", " - ")
    for prefix in prefixes:
        if filename.startswith(prefix):
            filename = filename[len(prefix) :]
    filename = os.path.splitext(filename)[0]
    for old, new in {"+": " ", "_": " ", "__": " ", "  ": " "}.items():
        filename = filename.replace(old, new)
    return " ".join(
        part if part.lower() in {"4k", "1080p", "180", "6k", "1920p"} else part.title()
        for part in filename.split()
    ).strip()


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
        try:
            media["fps"] = round(float(numerator) / float(denominator or 1), 2)
        except (ValueError, ZeroDivisionError):
            pass
    if audio:
        media["audio_codec"] = audio.get("codec_name")
        media["audio_channels"] = audio.get("channels")
    file_format = probe.get("format", {})
    for key, cast in (("duration", float), ("bit_rate", int)):
        try:
            media[key] = cast(file_format[key])
        except (KeyError, TypeError, ValueError):
            pass
    return {key: value for key, value in media.items() if value not in (None, "")}


def read_media_info(video_file: Path) -> dict[str, object] | None:
    """Return the video's resolution, codecs and the like from ffprobe, or None when it cannot tell."""
    try:
        result = subprocess.run(
            [
                "ffprobe",
                "-loglevel", "error",
                "-show_entries",
                "stream=codec_type,codec_name,width,height,avg_frame_rate,channels"
                ":format=duration,bit_rate",
                "-output_format", "json",
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


def load_previous_media(output_path: Path) -> dict[str, dict]:
    """Return the previous catalogue's entries by source URL, to reuse their media info."""
    try:
        catalogue = json.loads(output_path.read_text(encoding="utf-8"))
        return {
            entry["src"]: entry
            for category in catalogue["videos"]
            for entry in category["list"]
            if "media" in entry
        }
    except (OSError, ValueError, KeyError, TypeError):
        return {}


def media_for(video_path: Path, previous_entry: dict | None, epoch: str) -> dict[str, object] | None:
    """Reuse the previous media info while the file is unchanged; probe it otherwise.

    Probing reads the file's header, which over a network mount is slow, so a
    regeneration only probes new or changed files.
    """
    if (
        previous_entry is not None
        and previous_entry.get("epoch") == epoch
        and previous_entry["media"].get("size") == video_path.stat().st_size
    ):
        return previous_entry["media"]
    return read_media_info(video_path)


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


def load_config(config_path: Path) -> configparser.ConfigParser:
    """Read and validate the separate local-library and web configuration."""
    config = configparser.ConfigParser()
    if not config.read(config_path):
        raise FileNotFoundError(f"Configuration file not found: {config_path}")
    for section_name in ("library", "web"):
        if section_name not in config:
            raise ValueError(f"Configuration must contain a [{section_name}] section.")
    section = config["library"]
    for option in ("videos_path", "thumbnails_path"):
        if not section.get(option):
            raise ValueError(f"Missing required [library] value: {option}")
    return config


def generate_category_entries(
    config: configparser.ConfigParser,
    previous: dict[str, dict] | None = None,
    probe_media: bool = True,
) -> dict[str, list[dict]]:
    """Build category entries using media roots and server URL prefixes only.

    `previous` holds the last catalogue's entries by source URL, whose media
    info is reused for unchanged files.
    """
    library = config["library"]
    web = config["web"]
    videos_dir = Path(library["videos_path"])
    thumbnails_dir = Path(library["thumbnails_path"])
    site_url_prefix = web.get("site_url_prefix", "/")
    videos_url_prefix = join_url_prefix(site_url_prefix, web.get("videos_url_prefix", "/media"))
    thumbnails_url_prefix = join_url_prefix(
        site_url_prefix, web.get("thumbnails_url_prefix", "/thumbnails")
    )
    if not videos_dir.is_dir():
        raise FileNotFoundError(f"Videos directory not found: {videos_dir}")

    previous = previous or {}
    category_map: dict[str, list[dict]] = defaultdict(list)
    for root, _, files in os.walk(videos_dir):
        root_path = Path(root)
        for filename in files:
            if not is_video_file(filename):
                continue
            video_path = root_path / filename
            relative_path = video_path.relative_to(videos_dir)
            thumbnail_path = (thumbnails_dir / relative_path).with_suffix(".jpg")
            category_name = root_path.name if root_path != videos_dir else "!Uncategorized"
            src = url_for_file(videos_url_prefix, relative_path)
            entry = {
                "name": clean_filename(filename),
                "src": src,
                "thumbnail": (
                    url_for_file(thumbnails_url_prefix, relative_path.with_suffix(".jpg"))
                    if thumbnail_path.exists()
                    else ""
                ),
                "screen_type": "sbs",
                **get_file_timestamps(video_path),
            }
            if probe_media:
                media = media_for(video_path, previous.get(src), entry["epoch"])
                if media:
                    entry["media"] = media
            category_map[category_name].append(entry)
    return category_map


def write_catalogue(category_map: dict[str, list[dict]], output_path: Path) -> int:
    """Write sorted catalogue data and return the number of video entries."""
    video_data = {
        "videos": [
            {"name": category, "list": sorted(entries, key=lambda item: float(item["epoch"]), reverse=True)}
            for category, entries in sorted(category_map.items())
        ]
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    # Replace the catalogue in one step, so a web server never serves a half-written file.
    partial_path = output_path.with_name(f"{output_path.name}.partial")
    partial_path.write_text(json.dumps(video_data, indent=4, ensure_ascii=False), encoding="utf-8")
    partial_path.replace(output_path)
    return sum(len(category["list"]) for category in video_data["videos"])


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("config", type=Path, help="Path to config.ini")
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT_PATH,
        help=f"Catalogue output path (default: {DEFAULT_OUTPUT_PATH})",
    )
    parser.add_argument(
        "--no-media-info",
        action="store_true",
        help="Skip reading resolution and codecs with ffprobe",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        category_map = generate_category_entries(
            load_config(args.config),
            previous=load_previous_media(args.output),
            probe_media=not args.no_media_info,
        )
        video_count = write_catalogue(category_map, args.output)
    except (OSError, ValueError) as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 1
    print(f"files.json created at {args.output.resolve()}")
    print(f"Found {len(category_map)} categories with {video_count} total videos")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
