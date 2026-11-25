import { Container, Image as UiImage, Text } from "@pmndrs/uikit";
import { SRGBColorSpace } from "three";
import type { Texture } from "three";

import { RADIUS, colour } from "../ui/theme.ts";
import { MM } from "../ui/uikit.ts";
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

export type ThumbnailTile = Container & {
    file: CatalogueEntry;
    thumbnailUrl: string;
    setImage(texture: Texture): void;
};

// `file` is the catalogue entry; `cellWidth` and `cellHeight` its grid cell,
// `margin` the space kept free around the tile inside it.
export function thumbnailTile(
    file: CatalogueEntry,
    { cellWidth, cellHeight, margin }: { cellWidth: number; cellHeight: number; margin: number },
): ThumbnailTile {
    const width = cellWidth - margin * 2;
    const height = cellHeight - margin * 2;
    const tile = new Container({
        width: width * MM,
        height: height * MM,
        margin: margin * MM,
        padding: PADDING * MM,
        flexShrink: 0,
        flexDirection: "column",
        alignItems: "center",
        borderRadius: RADIUS.tile * MM,
        backgroundColor: colour("raised"),
        color: colour("text"),
        hover: { backgroundColor: colour("hovered") },
        active: { backgroundColor: colour("accent"), color: colour("onAccent") },
        onClick: () => MAIN.playCatalogueVideo(file),
    }) as ThumbnailTile;

    const innerWidth = width - PADDING * 2;
    const innerHeight = height - PADDING * 2;
    const image = new UiImage({
        width: innerWidth * MM,
        height: (innerHeight - CAPTION_HEIGHT) * MM,
        flexShrink: 0,
        objectFit: "cover",
        keepAspectRatio: false,
        borderRadius: RADIUS.tile * 0.6 * MM,
        backgroundColor: colour("surface"),
        pointerEvents: "none",
    });
    // The name, on up to two lines, cut by the caption's edges past that.
    const caption = new Container({
        width: innerWidth * MM,
        height: CAPTION_HEIGHT * MM,
        flexShrink: 0,
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        pointerEvents: "none",
    });
    caption.add(
        new Text({
            text: sanitizeFontText(file.name),
            fontSize: CAPTION_FONT_SIZE * MM,
            textAlign: "center",
            pointerEvents: "none",
        }),
    );
    tile.add(image, caption);

    tile.file = file;
    tile.thumbnailUrl = file.thumbnail;
    tile.setImage = (texture: Texture) => {
        // uikit fits the image by the texture's matrix, which it sets itself.
        texture.colorSpace = SRGBColorSpace;
        texture.matrixAutoUpdate = false;
        image.setProperties({ src: texture });
    };
    return tile;
}
