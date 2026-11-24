import assert from "node:assert/strict";
import test from "node:test";

import { adjacentVideo } from "../src/adjacentVideo.ts";

const files = [{ src: "/a.mp4" }, { src: "/b.mp4" }, { src: "/c.mp4" }];

test("finds the next and previous video in the list", () => {
    assert.equal(adjacentVideo(files, "/b.mp4", 1)!.src, "/c.mp4");
    assert.equal(adjacentVideo(files, "/b.mp4", -1)!.src, "/a.mp4");
});

test("stops at either end of the list", () => {
    assert.equal(adjacentVideo(files, "/c.mp4", 1), null);
    assert.equal(adjacentVideo(files, "/a.mp4", -1), null);
});

test("finds nothing when the playing video isn't in the list", () => {
    assert.equal(adjacentVideo(files, "/elsewhere.mp4", 1), null);
    assert.equal(adjacentVideo(files, null, 1), null);
});
