"""Where an MP4 keeps its index: before the video data ("fast start") or after it.

A browser needs the index (the `moov` box) before it can play anything. When
it comes after the video data (`mdat`), the browser fetches the start of the
file, finds no index, and must ask for the end of the file before it shows a
frame, so the video starts slowly; on a cloud mount, reading the end can be
slow too. remux_faststart.py moves the index to the front without re-encoding.

Only the boxes' headers are read, a few bytes each, so checking a video is
cheap even on a cloud mount.
"""

from __future__ import annotations

import io
from pathlib import Path
import struct
from typing import BinaryIO


# The containers built from boxes, where the index can be at either end.
BOX_CONTAINER_SUFFIXES = {".mp4", ".m4v", ".mov"}


def find_top_level_boxes(stream: BinaryIO) -> list[tuple[str, int, int]]:
    """Return (type, offset, size) for valid top-level ISO BMFF boxes."""
    boxes: list[tuple[str, int, int]] = []
    stream.seek(0, io.SEEK_END)
    file_size = stream.tell()
    stream.seek(0)

    while stream.tell() < file_size:
        offset = stream.tell()
        header = stream.read(8)
        if len(header) != 8:
            raise ValueError(f"Truncated box header at byte {offset}.")
        size, raw_type = struct.unpack(">I4s", header)
        box_type = raw_type.decode("ascii", errors="replace")
        header_size = 8
        if size == 1:
            extended_size = stream.read(8)
            if len(extended_size) != 8:
                raise ValueError(f"Truncated extended size at byte {offset}.")
            size = struct.unpack(">Q", extended_size)[0]
            header_size = 16
        elif size == 0:
            size = file_size - offset
        if size < header_size or offset + size > file_size:
            raise ValueError(f"Invalid {box_type!r} box size at byte {offset}.")
        boxes.append((box_type, offset, size))
        stream.seek(offset + size)
    return boxes


def needs_faststart(path: Path) -> bool:
    """Return whether an MP4 stores moov after mdat."""
    with path.open("rb") as stream:
        box_types = [box_type for box_type, _, _ in find_top_level_boxes(stream)]
    try:
        return box_types.index("moov") > box_types.index("mdat")
    except ValueError as error:
        raise ValueError("Missing required moov or mdat box.") from error
