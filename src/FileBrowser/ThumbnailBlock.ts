import { Block, Text } from "../ui/meshUi.ts";
import type { Texture } from "three";

import { FONT } from "../ui/kit.ts";
import { RADIUS, colour, textOn } from "../ui/theme.ts";
import type { ColourName } from "../ui/theme.ts";
import { sanitizeFontText } from "../font.ts";

import * as MAIN from "../index.ts";
import type { CatalogueEntry } from "../types/catalogue.ts";

// One video in the library grid: its thumbnail above its name, on a card
// that lightens under the pointer. The tile fills its grid cell less a
// margin on every side, and pads its content evenly, so neighbouring
// highlights never touch and none is cut off. The thumbnail covers its area
// without stretching, and an empty frame holds its place until it loads.
const PADDING = 0.04;
const CAPTION_HEIGHT = 0.2;
const CAPTION_FONT_SIZE = 0.065;

const look = (background: ColourName) => ({
    backgroundColor: colour(background),
    backgroundOpacity: 1,
    fontColor: textOn(background),
});
const STATES = {
    idle: look("raised"),
    hovered: look("hovered"),
    selected: look("accent"),
};

export default class ThumbnailBlock extends Block {
    file: CatalogueEntry;
    thumbnailUrl: string;
    image: Block;

    // `file` is the catalogue entry; `cellWidth` and `cellHeight` its grid
    // cell, `margin` the space kept free around the tile inside it.
    constructor(
        file: CatalogueEntry,
        { cellWidth, cellHeight, margin }: { cellWidth: number; cellHeight: number; margin: number }
    ) {
        const width = cellWidth - margin * 2;
        const height = cellHeight - margin * 2;
        super({
            width,
            height,
            margin,
            padding: PADDING,
            contentDirection: "column",
            justifyContent: "start",
            alignItems: "center",
            borderRadius: RADIUS.tile,
            ...FONT,
            ...STATES.idle,
        });
        this.file = file;
        this.thumbnailUrl = file.thumbnail;

        const innerWidth = width - PADDING * 2;
        const innerHeight = height - PADDING * 2;
        this.image = new Block({
            width: innerWidth,
            height: innerHeight - CAPTION_HEIGHT,
            backgroundColor: colour("surface"),
            backgroundOpacity: 1,
            backgroundSize: "cover",
            borderRadius: RADIUS.tile * 0.6,
        });
        const caption = new Block({
            width: innerWidth,
            height: CAPTION_HEIGHT,
            justifyContent: "center",
            backgroundOpacity: 0,
            bestFit: "shrink",
        }).add(
            new Text({
                content: sanitizeFontText(file.name),
                fontSize: CAPTION_FONT_SIZE,
            })
        );
        this.add(this.image, caption);

        this.setupState({
            state: "selected",
            attributes: STATES.selected,
            onSet: () => MAIN.playCatalogueVideo(file),
        });
        this.setupState({ state: "hovered", attributes: STATES.hovered });
        this.setupState({ state: "idle", attributes: STATES.idle });
    }

    setImage(texture: Texture): void {
        this.image.set({
            backgroundTexture: texture,
            // White, so the image shows in its own colours.
            backgroundColor: colour("white"),
        });
    }
}
