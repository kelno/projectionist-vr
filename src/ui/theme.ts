import { Color, LinearSRGBColorSpace } from "three";

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
    // Text on the accent colour, too light a background for light text.
    onAccent: 0x1f1c1a,
    // The power button while hovered, and the mute button while muted.
    danger: 0xe5534b,
    text: 0xefe9e3,
    // Secondary text: placeholders, names of values, the version.
    mutedText: 0xa89f96,
    // Headings in the help panels.
    heading: 0xf2bc7a,
    // The seek bar's track, under the played part.
    track: 0x3d3732,
    // The edge of a window or panel, so it stands out from what's behind.
    border: 0x564e47,
    // Under an image, which three-mesh-ui tints with the background colour:
    // white shows it in its own colours.
    white: 0xffffff,
};

// A theme colour's name, such as "accent".
export type ColourName = keyof typeof HEX;

// Each colour as a three.js Color for three-mesh-ui components. three.js
// takes a hex colour as sRGB and converts it to linear values, which its own
// materials convert back on output; three-mesh-ui's don't, so a colour given
// the usual way shows much darker than written (#4d8dff showed as #1344ff).
// Read as already linear, it reaches the screen as written. three-mesh-ui
// keeps the Color object it's given, so each call returns a new one.
export const colour = (name: ColourName): Color => new Color().setHex(HEX[name], LinearSRGBColorSpace);

// The text colour that reads on a background of the named colour.
export const textOn = (background: ColourName): Color => colour(background === "accent" ? "onAccent" : "text");

// The same colour for a plain three.js material, which converts it properly.
export const materialColour = (name: ColourName): Color => new Color(HEX[name]);

// Panels are solid: see-through, the video tinted them.
export const SURFACE_OPACITY = 1;

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
