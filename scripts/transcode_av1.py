#!/usr/bin/env python3
"""Re-encode AV1 videos to HEVC for headsets without AV1 hardware decoding.

The default mode is read-only: it lists AV1 files and leftover temporary
outputs. With --apply, each AV1 file is encoded one at a time to a temporary
MP4 beside it, verified, and then swapped in place of the source. MP4 sources
keep their name; MKV, WebM and MOV sources become a sibling .mp4 and the source
is deleted. Re-encoding is lossy, and subtitle and attachment streams are not
carried over.

Interrupted runs can be resumed by running the same command again: leftover
temporary outputs are deleted and their sources are encoded from the start.
Do not run two instances on the same tree at once.
"""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys


VIDEO_SUFFIXES = {".mkv", ".mov", ".mp4", ".webm"}
TEMPORARY_MARKER = ".av1-hevc-tmp"
# Audio codecs that ffmpeg can stream-copy into an MP4 the Quest browser plays.
MP4_AUDIO_CODECS = {"aac", "ac3", "eac3", "flac", "mp3", "opus"}
DURATION_TOLERANCE_SECONDS = 1.0


def probe(path: Path, ffprobe: str) -> dict:
    """Return ffprobe's stream and format description of a file."""
    result = subprocess.run(
        [ffprobe, "-v", "error", "-show_entries",
         "stream=index,codec_type,codec_name,pix_fmt:stream_disposition=attached_pic:format=duration",
         "-of", "json", str(path)],
        check=True,
        capture_output=True,
        text=True,
    )
    return json.loads(result.stdout)


def main_video_stream(info: dict) -> dict | None:
    """Return the first video stream that is not cover art."""
    for stream in info.get("streams", []):
        if stream.get("codec_type") == "video" and not stream.get("disposition", {}).get("attached_pic"):
            return stream
    return None


def audio_streams(info: dict) -> list[dict]:
    return [stream for stream in info.get("streams", []) if stream.get("codec_type") == "audio"]


def duration(info: dict) -> float:
    return float(info.get("format", {}).get("duration", "nan"))


def is_temporary(path: Path) -> bool:
    return path.name.startswith(".") and path.stem.endswith(TEMPORARY_MARKER)


def temporary_path(source: Path) -> Path:
    """Return the hidden in-progress output path for a source file."""
    return source.with_name(f".{source.stem}{TEMPORARY_MARKER}.mp4")


def output_path(source: Path) -> Path:
    return source.with_suffix(".mp4")


def find_files(directory: Path) -> tuple[list[Path], list[Path]]:
    """Return (videos, leftover temporary outputs) under a directory tree."""
    videos: list[Path] = []
    leftovers: list[Path] = []
    for path in directory.rglob("*"):
        if not path.is_file() or path.suffix.lower() not in VIDEO_SUFFIXES:
            continue
        (leftovers if is_temporary(path) else videos).append(path)
    key = lambda path: str(path).lower()
    return sorted(videos, key=key), sorted(leftovers, key=key)


def build_command(source: Path, temporary: Path, info: dict, ffmpeg: str, crf: int, preset: str) -> list[str]:
    """Build the ffmpeg command that re-encodes video and keeps compatible audio."""
    video = main_video_stream(info)
    ten_bit = "10" in (video.get("pix_fmt") or "")
    audio = audio_streams(info)
    audio_args = ["-map", "0:a?"]
    if audio and all(stream.get("codec_name") in MP4_AUDIO_CODECS for stream in audio):
        audio_args += ["-c:a", "copy"]
    else:
        audio_args += ["-c:a", "aac", "-b:a", "192k"]
    return [
        ffmpeg, "-hide_banner", "-loglevel", "error", "-stats", "-nostdin",
        "-i", str(source),
        "-map", f"0:{video['index']}", *audio_args,
        "-c:v", "libx265", "-crf", str(crf), "-preset", preset, "-x265-params", "log-level=error",
        "-pix_fmt", "yuv420p10le" if ten_bit else "yuv420p",
        "-tag:v", "hvc1", "-movflags", "+faststart",
        str(temporary),
    ]


def verify_output(path: Path, source_info: dict, ffprobe: str) -> None:
    """Raise unless a file is HEVC with the source's duration and audio count."""
    info = probe(path, ffprobe)
    video = main_video_stream(info)
    if video is None or video.get("codec_name") != "hevc":
        raise RuntimeError("Output does not contain an HEVC video stream.")
    if abs(duration(info) - duration(source_info)) > DURATION_TOLERANCE_SECONDS:
        raise RuntimeError(f"Output duration {duration(info):.1f}s does not match source {duration(source_info):.1f}s.")
    if len(audio_streams(info)) != len(audio_streams(source_info)):
        raise RuntimeError("Output does not contain every source audio stream.")


def transcode(source: Path, info: dict, args: argparse.Namespace) -> Path:
    """Encode a source to a temporary file, verify it, and swap it into place."""
    temporary = temporary_path(source)
    output = output_path(source)
    try:
        subprocess.run(build_command(source, temporary, info, args.ffmpeg, args.crf, args.preset), check=True)
        verify_output(temporary, info, args.ffprobe)
        os.replace(temporary, output)
    finally:
        temporary.unlink(missing_ok=True)
    if output != source:
        source.unlink()
    return output


def finished_output_exists(source: Path, info: dict, ffprobe: str) -> bool:
    """Return whether a previous run already published this source's output.

    A run interrupted between publishing an MKV's .mp4 and deleting the MKV
    leaves both behind; the verified output proves the encode completed.
    """
    output = output_path(source)
    if output == source or not output.exists():
        return False
    try:
        verify_output(output, info, ffprobe)
    except (RuntimeError, ValueError, json.JSONDecodeError, subprocess.CalledProcessError):
        return False
    return True


class ProgressLine:
    """A single overwritten status line on an interactive terminal."""

    def __init__(self) -> None:
        self.enabled = sys.stderr.isatty()
        self.width = 0

    def show(self, text: str) -> None:
        if not self.enabled:
            return
        text = text[: shutil.get_terminal_size().columns - 1]
        sys.stderr.write("\r" + text.ljust(self.width))
        sys.stderr.flush()
        self.width = len(text)

    def clear(self) -> None:
        if self.enabled and self.width:
            sys.stderr.write("\r" + " " * self.width + "\r")
            sys.stderr.flush()
            self.width = 0

    def print(self, text: str) -> None:
        """Print a permanent line in place of the status line."""
        self.clear()
        print(text, flush=True)


progress = ProgressLine()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("directory", type=Path, help="Directory tree containing videos")
    parser.add_argument("--apply", action="store_true", help="Re-encode AV1 files and replace their sources")
    parser.add_argument("--crf", type=int, default=20, help="x265 quality; lower is better and larger (default: 20)")
    parser.add_argument("--preset", default="medium", help="x265 speed preset (default: medium)")
    parser.add_argument("--ffmpeg", default="ffmpeg", help="ffmpeg executable to run")
    parser.add_argument("--ffprobe", default="ffprobe", help="ffprobe executable to run")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if not args.directory.is_dir():
        print(f"Not a directory: {args.directory}", file=sys.stderr)
        return 2
    for tool in (args.ffprobe, args.ffmpeg) if args.apply else (args.ffprobe,):
        if shutil.which(tool) is None:
            print(f"Executable was not found: {tool}", file=sys.stderr)
            return 2

    print(f"Scanning {args.directory} ...", flush=True)
    videos, leftovers = find_files(args.directory)
    print(f"Found {len(videos)} video file(s).", flush=True)
    for leftover in leftovers:
        if not args.apply:
            print(f"LEFTOVER TEMPORARY  {leftover}")
            continue
        leftover.unlink()
        print(f"REMOVED LEFTOVER  {leftover}")

    # Each file is probed and, with --apply, encoded before the next is probed,
    # so a slow drive shows results as they come rather than after a full scan.
    found = converted = failed = 0
    for number, path in enumerate(videos, start=1):
        progress.show(f"Checking [{number}/{len(videos)}]  {path.name}")
        try:
            info = probe(path, args.ffprobe)
        except (OSError, json.JSONDecodeError, subprocess.CalledProcessError) as error:
            progress.print(f"ERROR  {path}: {error}")
            continue
        video = main_video_stream(info)
        if video is None or video.get("codec_name") != "av1":
            continue
        if finished_output_exists(path, info, args.ffprobe):
            if not args.apply:
                progress.print(f"NEEDS SOURCE CLEANUP  {path} (already converted to {output_path(path)})")
                continue
            path.unlink()
            progress.print(f"REMOVED CONVERTED SOURCE  {path}")
            continue
        if output_path(path) != path and output_path(path).exists():
            progress.print(f"SKIP OUTPUT EXISTS  {path} -> {output_path(path)}")
            continue
        found += 1
        if not args.apply:
            progress.print(f"NEEDS TRANSCODE  {path}")
            continue
        progress.print(f"TRANSCODING [{number}/{len(videos)}]  {path}")
        try:
            output = transcode(path, info, args)
        except (OSError, RuntimeError, ValueError, json.JSONDecodeError, subprocess.CalledProcessError) as error:
            print(f"ERROR  {path}: {error}")
            failed += 1
            continue
        converted += 1
        print(f"TRANSCODED  {output}")

    progress.clear()
    if not args.apply:
        print(f"{found} AV1 file(s) to transcode. Run again with --apply to convert them.")
        return 0
    print(f"Transcoded {converted} file(s); {failed} failed.")
    return 1 if failed else 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        progress.clear()
        print("\nInterrupted. Run the same command again to resume.", file=sys.stderr)
        raise SystemExit(130)
