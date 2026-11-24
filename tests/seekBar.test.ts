import assert from "node:assert/strict";
import test from "node:test";

import { clockTime, seekTile } from "../src/seekBar.ts";

// 10 frames, 4 a row: three rows, the last one half empty.
const seek = { url: "/thumbnails/a.seek.jpg", interval: 10, columns: 4, count: 10 };

test("the first frame is the top-left tile", () => {
    assert.deepEqual(seekTile(seek, 0), { offset: [0, 2 / 3], repeat: [0.25, 1 / 3] });
    assert.deepEqual(seekTile(seek, 9.9).offset, [0, 2 / 3]);
});

test("frames fill the grid row by row", () => {
    assert.deepEqual(seekTile(seek, 35).offset, [0.75, 2 / 3]);
    assert.deepEqual(seekTile(seek, 40).offset, [0, 1 / 3]);
    assert.deepEqual(seekTile(seek, 95).offset, [0.25, 0]);
});

test("times outside the video show its first or last frame", () => {
    assert.deepEqual(seekTile(seek, -1).offset, [0, 2 / 3]);
    assert.deepEqual(seekTile(seek, 500).offset, [0.25, 0]);
});

test("times read as hours, minutes and seconds", () => {
    assert.equal(clockTime(3723), "01:02:03");
});
