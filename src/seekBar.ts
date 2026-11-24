import type { SeekThumbnails } from "./types/catalogue.ts";

// "01:02:03" for 3723 seconds.
export function clockTime(seconds: number): string {
    return new Date(seconds * 1000).toISOString().substring(11, 19);
}

// Where the seek thumbnail for a time sits in its image, as the part of a
// texture to show: `offset` is the tile's bottom-left corner and `repeat` its
// size, both from 0 to 1, with y going up (three.js flips the image).
export interface TileArea {
    offset: [number, number];
    repeat: [number, number];
}

export function seekTile(seek: SeekThumbnails, seconds: number): TileArea {
    const rows = Math.ceil(seek.count / seek.columns);
    const index = Math.min(Math.max(Math.floor(seconds / seek.interval), 0), seek.count - 1);
    const column = index % seek.columns;
    const row = Math.floor(index / seek.columns);
    return {
        offset: [column / seek.columns, (rows - row - 1) / rows],
        repeat: [1 / seek.columns, 1 / rows],
    };
}
