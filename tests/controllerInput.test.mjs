import assert from "node:assert/strict";
import test from "node:test";

import {
    LEAVE_VR_HOLD_MS,
    createControllerInput,
    readGamepad,
} from "../src/input/controllerInput.mjs";

const idle = { grip: false, a: false, b: false, x: 0, y: 0 };
const PLAYER = { playing: true };
const LIBRARY = { playing: false };

function run(frames, context = PLAYER) {
    const step = createControllerInput();
    return frames.map(([state, now = 0]) => step({ ...idle, ...state }, context, now));
}

test("reads an xr-standard gamepad, missing parts as released", () => {
    const pressed = (value) => ({ pressed: value });
    const gamepad = {
        buttons: [pressed(false), pressed(true), pressed(false), pressed(false), pressed(true)],
        axes: [0, 0, 0.5],
    };
    assert.deepEqual(readGamepad(gamepad), { grip: true, a: true, b: false, x: 0.5, y: 0 });
});

test("up and down zoom while held, in the player only", () => {
    assert.deepEqual(run([[{ y: -0.9 }], [{ y: -0.9 }]]), [
        [{ type: "zoom", direction: "in" }],
        [{ type: "zoom", direction: "in" }],
    ]);
    assert.deepEqual(run([[{ y: 0.9 }]]), [[{ type: "zoom", direction: "out" }]]);
    assert.deepEqual(run([[{ y: 0.9 }]], LIBRARY), [[]]);
});

test("grip + up or down tilts while held", () => {
    assert.deepEqual(run([[{ grip: true, y: -0.9 }], [{ grip: true, y: -0.9 }]]), [
        [{ type: "tilt", direction: "up" }],
        [{ type: "tilt", direction: "up" }],
    ]);
    assert.deepEqual(run([[{ grip: true, y: 0.9 }]]), [[{ type: "tilt", direction: "down" }]]);
});

test("left and right seek once per push, until the stick is centred", () => {
    assert.deepEqual(run([[{ x: 0.9 }], [{ x: 0.9 }], [{}], [{ x: -0.9 }]]), [
        [{ type: "seek", seconds: 10 }],
        [],
        [],
        [{ type: "seek", seconds: -10 }],
    ]);
});

test("grip + left or right moves to the adjacent video", () => {
    assert.deepEqual(run([[{ grip: true, x: 0.9 }]]), [[{ type: "adjacentVideo", offset: 1 }]]);
    assert.deepEqual(run([[{ grip: true, x: -0.9 }]]), [[{ type: "adjacentVideo", offset: -1 }]]);
});

test("left and right turn pages in the library, with or without the grip", () => {
    assert.deepEqual(run([[{ x: 0.9 }]], LIBRARY), [[{ type: "page", offset: 1 }]]);
    assert.deepEqual(run([[{ grip: true, x: -0.9 }]], LIBRARY), [[{ type: "page", offset: -1 }]]);
});

test("a held zoom isn't turned into a seek by a sideways push", () => {
    assert.deepEqual(run([[{ y: -0.9 }], [{ x: 0.9, y: -0.9 }], [{ x: 0.9 }]]), [
        [{ type: "zoom", direction: "in" }],
        [{ type: "zoom", direction: "in" }],
        [],
    ]);
});

test("A plays or pauses and B leaves the video, once per press", () => {
    assert.deepEqual(run([[{ a: true }], [{ a: true }], [{}], [{ a: true }]]), [
        [{ type: "playPause" }],
        [],
        [],
        [{ type: "playPause" }],
    ]);
    assert.deepEqual(run([[{ b: true }], [{ b: true }]]), [[{ type: "exitToLibrary" }], []]);
    assert.deepEqual(run([[{ a: true }]], LIBRARY), [[]]);
});

test("buttons aren't read while the stick is pushed", () => {
    assert.deepEqual(run([[{ a: true, y: -0.9 }]]), [[{ type: "zoom", direction: "in" }]]);
});

test("grip + B leaves the video at once, and VR after a second's hold", () => {
    const held = { grip: true, b: true };
    assert.deepEqual(
        run([
            [held, 0],
            [held, LEAVE_VR_HOLD_MS - 1],
            [held, LEAVE_VR_HOLD_MS],
            [held, LEAVE_VR_HOLD_MS + 500],
        ]),
        [[{ type: "exitToLibrary" }], [], [{ type: "leaveVR" }], []]
    );
});

test("grip + B held in the library only leaves VR", () => {
    const held = { grip: true, b: true };
    assert.deepEqual(run([[held, 0], [held, LEAVE_VR_HOLD_MS]], LIBRARY), [[], [{ type: "leaveVR" }]]);
});

test("B pressed before the grip doesn't leave the video twice", () => {
    assert.deepEqual(
        run([
            [{ b: true }, 0],
            [{ grip: true, b: true }, 100],
            [{ grip: true, b: true }, 100 + LEAVE_VR_HOLD_MS],
        ]),
        [[{ type: "exitToLibrary" }], [], [{ type: "leaveVR" }]]
    );
});
