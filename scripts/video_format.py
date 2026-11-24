"""Guess a video's layout (the catalogue's `screen_type`) from its file name and its frame's shape."""

from __future__ import annotations

import re

# File name markers, as whole words (separated by anything but a letter or digit).
SIDE_BY_SIDE_MARKERS = {"sbs", "lr", "3dh", "180", "180x180"}
TOP_BOTTOM_MARKERS = {"tb", "ou", "3dv", "overunder"}
FLAT_MARKERS = {"2d", "flat"}
FULL_SPHERE_MARKER = "360"

# Frame shapes (width / height), and how far a frame may be from one.
SHAPE_TOLERANCE = 0.08
SHAPES = (
    (2.0, "sbs"),  # two square 180° eyes side by side
    (0.5, "tb"),  # two square 180° eyes one above the other
    (1.0, "360"),  # two 2:1 360° eyes one above the other
    (16 / 9, "screen"),  # a flat video
)
DEFAULT_SCREEN_TYPE = "sbs"


def name_markers(file_name: str) -> set[str]:
    stem = file_name.rsplit(".", 1)[0]
    return {word for word in re.split(r"[^a-z0-9]+", stem.lower()) if word}


def guess_screen_type(file_name: str, width: object = None, height: object = None) -> str:
    """The layout the name says, else the one the frame's shape suggests, else side-by-side 180°."""
    markers = name_markers(file_name)
    if markers & FLAT_MARKERS:
        return "screen"
    if FULL_SPHERE_MARKER in markers:
        return "360"
    if markers & TOP_BOTTOM_MARKERS:
        return "tb"
    if markers & SIDE_BY_SIDE_MARKERS:
        return "sbs"
    if isinstance(width, int) and isinstance(height, int) and width > 0 and height > 0:
        ratio = width / height
        for shape, screen_type in SHAPES:
            if abs(ratio - shape) <= shape * SHAPE_TOLERANCE:
                return screen_type
    return DEFAULT_SCREEN_TYPE
