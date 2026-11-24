import assert from "node:assert/strict";
import test from "node:test";

import { watchVideoTexture } from "../src/videoTextureWatchdog.mjs";

function setup() {
    const texture = {
        version: 0,
        set needsUpdate(value) {
            if (value) this.version++;
        },
    };
    const video = {
        paused: false,
        ended: false,
        readyState: 4,
        currentTime: 0,
        callbacks: new Map(),
        nextId: 1,
        cancelled: [],
        requestVideoFrameCallback(callback) {
            const id = this.nextId++;
            this.callbacks.set(id, callback);
            return id;
        },
        cancelVideoFrameCallback(id) {
            this.cancelled.push(id);
            this.callbacks.delete(id);
        },
    };
    return { video, texture, check: watchVideoTexture(video, texture, 300) };
}

test("leaves a picture that keeps refreshing alone", () => {
    const { video, texture, check } = setup();
    for (let now = 0; now < 2000; now += 16) {
        video.currentTime = now / 1000;
        texture.needsUpdate = true;
        check(now);
    }
    assert.equal(video.callbacks.size, 0);
});

test("restarts frame callbacks when a playing video's picture is stuck", () => {
    const { video, texture, check } = setup();
    check(0);
    video.currentTime = 0.5;
    check(500);
    assert.equal(video.callbacks.size, 1);
    const versionAfterRestart = texture.version;
    assert.ok(versionAfterRestart > 0);

    // The new chain keeps the picture refreshing on each video frame.
    const [[id, callback]] = video.callbacks;
    video.callbacks.delete(id);
    callback();
    assert.equal(texture.version, versionAfterRestart + 1);
    assert.equal(video.callbacks.size, 1);
});

test("does nothing for a paused or buffering video", () => {
    const { video, check } = setup();
    video.paused = true;
    check(0);
    video.currentTime = 1;
    check(1000);
    assert.equal(video.callbacks.size, 0);

    video.paused = false;
    check(1100);
    // Buffering: the time doesn't move.
    check(2000);
    assert.equal(video.callbacks.size, 0);
});
