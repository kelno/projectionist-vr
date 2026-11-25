import { Color } from "three";

// The player's look, in one place: every panel takes its colours, spacing and
// corner radii from here. Warm charcoal, with one amber accent for what is
// current or active (the played part of the video, the open folder, the
// selected mode or sort): dark panels don't glare next to the video. The owner
// chose it among five palettes on 2026-11-24.

const HEX = {
    // A window or panel's background.
    surface: 0x1f1c1a,
    // Buttons, tiles, the search bar: a step lighter than the surface.
    raised: 0x2f2a26,
    // What the pointer is on.
    hovered: 0x463f39,
    // A button while pressed, and what is current or active.
    accent: 0xe8963a,
    // What is current or active, while the pointer is on it.
    accentHovered: 0xf0b067,
    // Text on the accent colour, too light a background for light text.
    onAccent: 0x1f1c1a,
    // The power button while hovered, and the mute button while muted.
    danger: 0xe5534b,
    // The mute button while muted and the pointer is on it.
    dangerHovered: 0xec7a73,
    text: 0xefe9e3,
    // Secondary text: placeholders, names of values, the version.
    mutedText: 0xa89f96,
    // Headings in the help panels.
    heading: 0xf2bc7a,
    // The seek bar's track, under the played part.
    track: 0x3d3732,
    // The edge of a window or panel, so it stands out from what's behind.
    border: 0x564e47,
};

// A theme colour's name, such as "accent".
export type ColourName = keyof typeof HEX;

// A theme colour as a three.js Color, a new one each time.
export const colour = (name: ColourName): Color => new Color(HEX[name]);

// The width of a panel's edge, in metres.
export const BORDER_WIDTH = 0.008;

// Spacing, in metres: one step and its multiples.
export const SPACE = 0.02;
export const space = (steps: number): number => steps * SPACE;

export const RADIUS = {
    panel: 0.06,
    button: 0.05,
    tile: 0.04,
};
