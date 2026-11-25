import assert from "node:assert/strict";
import test from "node:test";

import { createBufferingTracker, createEndStallTracker, isBuffering } from "../src/bufferingState.ts";

interface FakeVideoState {
    src?: string | null;
    seeking?: boolean;
    paused?: boolean;
    ended?: boolean;
    readyState?: number;
}

function fakeVideo(state: FakeVideoState) {
    return {
        src: "/a.mp4",
        seeking: false,
        paused: false,
        ended: false,
        readyState: 4,
        ...state,
        getAttribute() {
            return this.src;
        },
    };
}

test("a seeking video is buffering, even paused", () => {
    assert.equal(isBuffering(fakeVideo({ seeking: true, paused: true })), true);
});

test("a playing video short of data is buffering", () => {
    assert.equal(isBuffering(fakeVideo({ readyState: 2 })), true);
    assert.equal(isBuffering(fakeVideo({ readyState: 4 })), false);
});

test("a paused, ended or source-less video isn't", () => {
    assert.equal(isBuffering(fakeVideo({ readyState: 1, paused: true })), false);
    assert.equal(isBuffering(fakeVideo({ readyState: 1, ended: true })), false);
    assert.equal(isBuffering(fakeVideo({ src: null, seeking: true })), false);
});

test("the indicator shows only after the delay, and resets", () => {
    const shouldShow = createBufferingTracker(250);
    assert.equal(shouldShow(true, 1000), false);
    assert.equal(shouldShow(true, 1200), false);
    assert.equal(shouldShow(true, 1250), true);
    assert.equal(shouldShow(false, 1300), false);
    assert.equal(shouldShow(true, 1400), false);
});

test("a video stuck for a second just before its end has stalled there", () => {
    const stalledAtEnd = createEndStallTracker();
    const video = { paused: false, ended: false, currentTime: 119.5, duration: 120.04 };
    assert.equal(stalledAtEnd(video, 0), false);
    assert.equal(stalledAtEnd(video, 900), false);
    assert.equal(stalledAtEnd(video, 1000), true);
});

test("a video still moving, paused, ended or far from its end hasn't stalled at it", () => {
    const stalledAtEnd = createEndStallTracker();
    assert.equal(stalledAtEnd({ paused: false, ended: false, currentTime: 119.5, duration: 120 }, 0), false);
    assert.equal(stalledAtEnd({ paused: false, ended: false, currentTime: 119.6, duration: 120 }, 2000), false);
    for (const video of [
        { paused: true, ended: false, currentTime: 119.6, duration: 120 },
        { paused: false, ended: true, currentTime: 120, duration: 120 },
        { paused: false, ended: false, currentTime: 60, duration: 120 },
        { paused: false, ended: false, currentTime: 0, duration: NaN },
    ]) {
        assert.equal(stalledAtEnd(video, 0), false);
        assert.equal(stalledAtEnd(video, 5000), false);
    }
});
