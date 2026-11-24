import {
    Group,
    LinearFilter,
    Mesh,
    MeshBasicMaterial,
    PlaneGeometry,
    SRGBColorSpace,
    TextureLoader,
    Vector3,
} from "three";
import type { Object3D, Texture } from "three";

import { Block, Text } from "./meshUi.ts";
import { FONT, SURFACE } from "./kit.ts";
import { RADIUS, colour, space } from "./theme.ts";
import { clockTime, seekTile } from "../seekBar.ts";
import type { SeekThumbnails } from "../types/catalogue.ts";

// While the pointer is on the seek bar: a card just above the bar, at the
// pointer, with the time it points at and, when the catalogue has seek
// thumbnails for the video, the frame at that time over it. The card faces
// the same way as the bar.
const IMAGE_WIDTH = 0.5;
const TIME_WIDTH = 0.26;
const TIME_HEIGHT = 0.09;
// Between the card and the bar, and around the frame inside the card.
const GAP = space(2);
const FRAME = space(1);

const point = new Vector3();

export function createSeekPreview({
    scene,
    seekBar,
    barWidth,
    barHeight,
    video,
    thumbnails,
}: {
    scene: Object3D;
    seekBar: Block;
    barWidth: number;
    barHeight: number;
    video: HTMLVideoElement;
    // The seek thumbnails of the video playing, if it has some.
    thumbnails: () => SeekThumbnails | undefined;
}): (target: Object3D | null) => void {
    const group = new Group();
    group.visible = false;
    scene.add(group);

    const timeText = new Text({ content: " ", fontSize: 0.05 });
    const card = new Block({
        width: TIME_WIDTH,
        height: TIME_HEIGHT,
        contentDirection: "column",
        justifyContent: "end",
        ...SURFACE,
        borderRadius: RADIUS.button,
        ...FONT,
        fontColor: colour("text"),
    }).add(
        new Block({ width: TIME_WIDTH, height: TIME_HEIGHT, justifyContent: "center", backgroundOpacity: 0 }).add(
            timeText,
        ),
    );
    group.add(card);

    // The frame is a plain three.js mesh showing one tile of the image.
    const material = new MeshBasicMaterial({ toneMapped: false });
    const image = new Mesh(new PlaneGeometry(1, 1), material);
    image.visible = false;
    group.add(image);

    let cardWidth = TIME_WIDTH;
    let shownUrl: string | undefined;
    let shownTime = "";
    let texture: Texture | null = null;

    // Size the card for the time alone, or for a frame of this height too.
    function layout(imageHeight: number | null): void {
        cardWidth = imageHeight === null ? TIME_WIDTH : IMAGE_WIDTH + 2 * FRAME;
        const cardHeight = imageHeight === null ? TIME_HEIGHT : imageHeight + 2 * FRAME + TIME_HEIGHT;
        card.set({ width: cardWidth, height: cardHeight });
        card.position.set(0, barHeight / 2 + GAP + cardHeight / 2, 0);
        image.visible = imageHeight !== null;
        if (imageHeight !== null) {
            image.scale.set(IMAGE_WIDTH, imageHeight, 1);
            // Slightly in front of the card, so it isn't hidden behind it.
            image.position.set(0, card.position.y + cardHeight / 2 - FRAME - imageHeight / 2, 0.005);
        }
    }
    layout(null);

    // Load the image of the video's seek thumbnails when the video changes.
    function load(seek: SeekThumbnails | undefined): void {
        if (seek?.url === shownUrl) {
            return;
        }
        shownUrl = seek?.url;
        texture?.dispose();
        texture = null;
        material.map = null;
        layout(null);
        if (!seek) {
            return;
        }
        new TextureLoader().load(seek.url, (loaded) => {
            if (shownUrl !== seek.url) {
                loaded.dispose();
                return;
            }
            // Each tile is drawn about at its own size: no mipmaps, which
            // would also blend neighbouring tiles at their edges.
            loaded.colorSpace = SRGBColorSpace;
            loaded.generateMipmaps = false;
            loaded.minFilter = LinearFilter;
            texture = loaded;
            material.map = loaded;
            material.needsUpdate = true;
            const { width, height } = loaded.image;
            const rows = Math.ceil(seek.count / seek.columns);
            layout((IMAGE_WIDTH * (height / rows)) / (width / seek.columns));
        });
    }

    // Call once per frame with the component the pointer is on, or null.
    return function update(target: Object3D | null): void {
        const duration = video.duration;
        if (target !== seekBar || !Number.isFinite(duration) || duration <= 0) {
            group.visible = false;
            return;
        }
        const seek = thumbnails();
        load(seek);

        const along = Math.min(Math.max(seekBar.uv.x, 0), 1);
        const seconds = duration * along;
        const time = clockTime(seconds);
        if (time !== shownTime) {
            shownTime = time;
            timeText.set({ content: time });
        }
        if (texture && seek) {
            const tile = seekTile(seek, seconds);
            texture.offset.set(...tile.offset);
            texture.repeat.set(...tile.repeat);
        }

        // Over the pointer, kept within the bar's length.
        const room = Math.max(barWidth / 2 - cardWidth / 2, 0);
        const x = Math.min(Math.max((along - 0.5) * barWidth, -room), room);
        seekBar.updateWorldMatrix(true, false);
        group.position.copy(seekBar.localToWorld(point.set(x, 0, 0.03)));
        seekBar.getWorldQuaternion(group.quaternion);
        seekBar.getWorldScale(group.scale);
        group.visible = true;
    };
}
