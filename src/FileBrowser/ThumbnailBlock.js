import { Color } from "three";
import { Block, Text } from "../ui/meshUi.js";

import { FONT } from "../ui/kit.js";
import { sanitizeFontText } from "../font.js";

import * as MAIN from "../index.js";

// One video in the library grid: its thumbnail above its name, in a frame
// that turns yellow under the pointer. The tile fills its grid cell less a
// margin on every side, and pads its content evenly, so neighbouring
// highlights never touch and none is cut off. The thumbnail covers its area
// without stretching, and an empty frame holds its place until it loads.
const PADDING = 0.04;
const CAPTION_HEIGHT = 0.2;
const CAPTION_FONT_SIZE = 0.065;

const STATES = {
    idle: { backgroundOpacity: 0, fontColor: new Color(0xffffff) },
    hovered: {
        backgroundColor: new Color(0xffff00),
        backgroundOpacity: 1,
        fontColor: new Color(0x000000),
    },
    selected: {
        backgroundColor: new Color(0x777777),
        backgroundOpacity: 1,
        fontColor: new Color(0x222222),
    },
};

export default class ThumbnailBlock extends Block {
    // `file` is the catalogue entry; `cellWidth` and `cellHeight` its grid
    // cell, `margin` the space kept free around the tile inside it.
    constructor(file, { cellWidth, cellHeight, margin }) {
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
            borderRadius: 0.05,
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
            backgroundColor: new Color(0x1a1a1a),
            backgroundOpacity: 1,
            backgroundSize: "cover",
            borderRadius: 0.03,
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

    setImage(texture) {
        this.image.set({
            backgroundTexture: texture,
            backgroundColor: new Color(0xffffff),
        });
    }
}
