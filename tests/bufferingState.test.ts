import assert from "node:assert/strict";
import test from "node:test";

import { createBufferingTracker, isBuffering } from "../src/bufferingState.ts";

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
