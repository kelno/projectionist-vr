import assert from "node:assert/strict";
import test from "node:test";

import { createControllerInput, readGamepad } from "../src/input/controllerInput.ts";

const idle = { grip: false, a: false, b: false, x: 0, y: 0 };
const PLAYER = { playing: true };
const LIBRARY = { playing: false };

function run(frames, context = PLAYER) {
    const step = createControllerInput();
    return frames.map(([state]) => step({ ...idle, ...state }, context));
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

// Runs frames where the context follows the actions, as in the app: leaving
// the video brings the library.
function runApp(frames, playing = true) {
    const step = createControllerInput();
    return frames.map((state) => {
        const actions = step({ ...idle, ...state }, { playing });
        if (actions.some((action) => action.type === "exitToLibrary")) {
            playing = false;
        }
        return actions;
    });
}

test("grip + B leaves the video from a video, VR from the library", () => {
    const held = { grip: true, b: true };
    assert.deepEqual(run([[held], [held]]), [[{ type: "exitToLibrary" }], []]);
    assert.deepEqual(run([[held], [held]], LIBRARY), [[{ type: "leaveVR" }], []]);
});

test("grip + B held from a video doesn't go on to leave VR", () => {
    const held = { grip: true, b: true };
    assert.deepEqual(runApp([held, held, held, { grip: true }, held]), [
        [{ type: "exitToLibrary" }],
        [],
        [],
        [],
        [{ type: "leaveVR" }],
    ]);
});

test("B pressed before the grip leaves the video only", () => {
    assert.deepEqual(runApp([{ b: true }, { grip: true, b: true }, { grip: true, b: true }]), [
        [{ type: "exitToLibrary" }],
        [],
        [],
    ]);
});
