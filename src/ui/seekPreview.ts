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

// While the pointer is on the seek bar: a card above the bar, at the pointer, with the time it points at and, when the catalogue has seek
// thumbnails for the video, the frame at that time over it. The card faces
// the same way as the bar.
const IMAGE_WIDTH = 0.5;
const TIME_WIDTH = 0.26;
const TIME_HEIGHT = 0.09;
// Around the frame inside the card.
const FRAME = space(1);

const point = new Vector3();
const centre = new Vector3();

export function createSeekPreview({
    scene,
    seekBar,
    panel,
    barWidth,
    lift,
    video,
    thumbnails,
}: {
    scene: Object3D;
    seekBar: Object3D & { uv?: { x: number; y: number } };
    // The panel holding the bar, whose scale the card takes.
    panel: () => Object3D;
    barWidth: number;
    // From the bar's middle to the card's bottom edge.
    lift: number;
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
    // Counts the loads started: only the latest one's image is used, even
    // when an older one is for the same video, left and come back to.
    let loads = 0;

    // Size the card for the time alone, or for a frame of this height too.
    function layout(imageHeight: number | null): void {
        cardWidth = imageHeight === null ? TIME_WIDTH : IMAGE_WIDTH + 2 * FRAME;
        const cardHeight = imageHeight === null ? TIME_HEIGHT : imageHeight + 2 * FRAME + TIME_HEIGHT;
        card.set({ width: cardWidth, height: cardHeight });
        card.position.set(0, lift + cardHeight / 2, 0);
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
        const thisLoad = ++loads;
        if (!seek) {
            return;
        }
        new TextureLoader().load(seek.url, (loaded) => {
            if (thisLoad !== loads) {
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

        const along = Math.min(Math.max(seekBar.uv?.x ?? 0, 0), 1);
        const seconds = duration * along;
        const time = clockTime(seconds);
        if (time !== shownTime) {
            shownTime = time;
            timeText.set({ content: time });
        }
        if (texture && seek) {
            // Half a pixel in from the tile's edges, so the neighbouring
            // tiles don't blend into its border.
            const tile = seekTile(seek, seconds);
            const { width, height } = texture.image as { width: number; height: number };
            texture.offset.set(tile.offset[0] + 0.5 / width, tile.offset[1] + 0.5 / height);
            texture.repeat.set(tile.repeat[0] - 1 / width, tile.repeat[1] - 1 / height);
        }

        // Over the pointer, kept within the bar's length.
        const room = Math.max(barWidth / 2 - cardWidth / 2, 0);
        const x = Math.min(Math.max((along - 0.5) * barWidth, -room), room);
        // The bar's world matrix also scales a unit square to its size, so
        // the scale comes from the panel: its own, times its parent's.
        seekBar.updateWorldMatrix(true, false);
        seekBar.getWorldPosition(centre);
        seekBar.getWorldQuaternion(group.quaternion);
        const holder = panel();
        holder.parent?.getWorldScale(group.scale);
        group.scale.multiply(holder.scale);
        group.position.copy(point.set(x, 0, 0.03).multiply(group.scale).applyQuaternion(group.quaternion).add(centre));
        group.visible = true;
    };
}
