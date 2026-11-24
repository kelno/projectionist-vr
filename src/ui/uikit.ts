import { Container, reversePainterSortStable } from "@pmndrs/uikit";
import type { ContainerProperties } from "@pmndrs/uikit";
import type { WebGLRenderer } from "three";

import FontJSON from "../../assets/fonts/Roboto-Regular-msdf.json";
import FontImage from "../../assets/fonts/Roboto-Regular.png";

// @pmndrs/uikit, which replaces three-mesh-ui one panel at a time. Its panels
// need two renderer settings (setupUikit), and each panel an update every
// frame (updateUikit), which lays it out and loads its fonts.

// Lengths in uikit are in "pixels"; at this size one is a millimetre, so a
// length in metres from the theme is that times 1000.
export const MM = 1000;

const roots = new Set<Container>();

// The player's own MSDF Roboto, the one three-mesh-ui uses, with its image's
// address from the build. uikit's bundled Roboto would add about 400 KB to the
// bundle, in four weights but not the regular one, with no more accents.
// The font has no space, which three-mesh-ui handled itself and uikit takes
// from the font: an empty glyph a quarter of the font's size wide, as in
// Roboto, stands in for it.
const SPACE = {
    id: 32,
    index: 0,
    char: " ",
    width: 0,
    height: 0,
    xoffset: 0,
    yoffset: 0,
    chnl: 15,
    x: 0,
    y: 0,
    page: 0,
};
const roboto = {
    normal: {
        ...FontJSON,
        info: { ...FontJSON.info, outline: 0 },
        chars: [...FontJSON.chars, { ...SPACE, xadvance: Math.round(FontJSON.info.size / 4) }],
        pages: [FontImage],
    },
};

export function setupUikit(renderer: WebGLRenderer): void {
    // Without these, content clipped by its parent draws outside it, and
    // panels and text are drawn in the wrong order and flicker.
    renderer.localClippingEnabled = true;
    renderer.setTransparentSort(reversePainterSortStable);
}

// A panel of `width` by `height` metres, centred on its position, in the
// player's font; it gets its update every frame.
export function uikitPanel(width: number, height: number, properties: ContainerProperties = {}): Container {
    const root = new Container({
        sizeX: width,
        sizeY: height,
        pixelSize: 1 / MM,
        fontFamilies: { roboto },
        fontFamily: "roboto",
        ...properties,
    });
    roots.add(root);
    return root;
}

// Call once per frame with the milliseconds since the last one.
export function updateUikit(delta: number): void {
    for (const root of roots) {
        root.update(delta);
    }
}
