import assert from "node:assert/strict";
import test from "node:test";

import {
    createPlaybackPositions,
    rememberPlaybackPosition,
    restorePlaybackPosition,
} from "../src/playbackPositions.mjs";

test("remembers a position per source", () => {
    const positions = createPlaybackPositions();
    positions.remember("/a.mp4", 42, 600);
    positions.remember("/b.mp4", 7, 600);
    assert.equal(positions.positionFor("/a.mp4"), 42);
    assert.equal(positions.positionFor("/b.mp4"), 7);
    assert.equal(positions.positionFor("/c.mp4"), null);
});

test("forgets a position at the very start or near the end", () => {
    const positions = createPlaybackPositions();
    positions.remember("/a.mp4", 42, 600);
    positions.remember("/a.mp4", 0.2, 600);
    assert.equal(positions.positionFor("/a.mp4"), null);

    positions.remember("/a.mp4", 42, 600);
    positions.remember("/a.mp4", 599, 600);
    assert.equal(positions.positionFor("/a.mp4"), null);
});

function createVideo(src, { currentTime = 0, duration = 600, readyState = 4, ended = false } = {}) {
    return {
        currentTime,
        duration,
        readyState,
        ended,
        getAttribute(name) {
            return name === "src" ? src : null;
        },
    };
}

test("resumes a video where it was left", () => {
    rememberPlaybackPosition(createVideo("/resume.mp4", { currentTime: 120 }));
    const video = createVideo("/resume.mp4");
    restorePlaybackPosition(video, "/resume.mp4");
    assert.equal(video.currentTime, 120);
});

test("a video that failed to load keeps the earlier position", () => {
    rememberPlaybackPosition(createVideo("/kept.mp4", { currentTime: 90 }));
    rememberPlaybackPosition(createVideo("/kept.mp4", { readyState: 0 }));
    const video = createVideo("/kept.mp4");
    restorePlaybackPosition(video, "/kept.mp4");
    assert.equal(video.currentTime, 90);
});

test("a finished video starts from the beginning next time", () => {
    rememberPlaybackPosition(createVideo("/done.mp4", { currentTime: 90 }));
    rememberPlaybackPosition(createVideo("/done.mp4", { currentTime: 600, ended: true }));
    const video = createVideo("/done.mp4");
    restorePlaybackPosition(video, "/done.mp4");
    assert.equal(video.currentTime, 0);
});
