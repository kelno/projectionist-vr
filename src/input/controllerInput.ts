// What the controller in use does, as a list of actions per frame, from its
// grip, A and B (X and Y on the left controller) and thumbstick. Kept apart
// from three.js so it can be tested; index.js reads the gamepad and carries
// the actions out.
//
// The thumbstick: up and down zoom the video, or tilt it with the grip held,
// for as long as it is pushed; left and right act once per push: seek 10 s,
// or with the grip held, previous or next video. In the library, left and
// right turn pages, with or without the grip.
//
// A plays or pauses and B goes back to the library, once per press, in the
// player. Grip + B goes back to the library from a video, and leaves VR from
// the library, once per press: a press that left a video must be released
// before the next one leaves VR.

export const STICK_THRESHOLD = 0.35;

// What readGamepad reads: the grip, A and B held, and the thumbstick's
// position, -1 to 1 (x to the right, y down).
export interface ControllerState {
    grip: boolean;
    a: boolean;
    b: boolean;
    x: number;
    y: number;
}

export type ControllerAction =
    | { type: "zoom"; direction: "in" | "out" }
    | { type: "tilt"; direction: "up" | "down" }
    | { type: "seek"; seconds: number }
    | { type: "adjacentVideo"; offset: number }
    | { type: "page"; offset: number }
    | { type: "playPause" }
    | { type: "exitToLibrary" }
    | { type: "leaveVR" };

// The parts of a WebXR "xr-standard" gamepad this uses.
export function readGamepad(gamepad: {
    readonly buttons: readonly { readonly pressed: boolean }[];
    readonly axes: readonly number[];
}): ControllerState {
    return {
        grip: gamepad.buttons[1]?.pressed ?? false,
        a: gamepad.buttons[4]?.pressed ?? false,
        b: gamepad.buttons[5]?.pressed ?? false,
        x: gamepad.axes[2] ?? 0,
        y: gamepad.axes[3] ?? 0,
    };
}

export function createControllerInput(): (state: ControllerState, context: { playing: boolean }) => ControllerAction[] {
    // The thumbstick: false when centred, "up" or "down" while held there,
    // true after a left or right push until it comes back to the centre.
    let stick: boolean | "up" | "down" = false;
    // Set by a press that acted, until A and B are both released.
    let buttonHeld = false;

    function stickActions({ grip, x, y }: ControllerState, playing: boolean): ControllerAction[] | null {
        const up = y < -STICK_THRESHOLD;
        const down = y > STICK_THRESHOLD;
        const sideways = Math.abs(x) > STICK_THRESHOLD;
        const offset = x > 0 ? 1 : -1;

        if (grip && up && (stick === false || stick === "up")) {
            stick = "up";
            return playing ? [{ type: "tilt", direction: "up" }] : [];
        }
        if (grip && down && (stick === false || stick === "down")) {
            stick = "down";
            return playing ? [{ type: "tilt", direction: "down" }] : [];
        }
        if (sideways && stick === false) {
            stick = true;
            if (!playing) {
                return [{ type: "page", offset }];
            }
            return grip
                ? [{ type: "adjacentVideo", offset }]
                : [{ type: "seek", seconds: 10 * offset }];
        }
        if (down && (stick === false || stick === "down")) {
            stick = "down";
            return playing ? [{ type: "zoom", direction: "out" }] : [];
        }
        if (up && (stick === false || stick === "up")) {
            stick = "up";
            return playing ? [{ type: "zoom", direction: "in" }] : [];
        }
        if (!sideways) {
            stick = false;
            return null; // centred: the buttons are read
        }
        return [];
    }

    function buttonActions({ grip, a, b }: ControllerState, playing: boolean): ControllerAction[] {
        if (grip && b && !buttonHeld) {
            buttonHeld = true;
            return [{ type: playing ? "exitToLibrary" : "leaveVR" }];
        }
        if (a && playing && !buttonHeld) {
            buttonHeld = true;
            return [{ type: "playPause" }];
        }
        if (b && playing && !buttonHeld) {
            buttonHeld = true;
            return [{ type: "exitToLibrary" }];
        }
        if (!a && !b) {
            buttonHeld = false;
        }
        return [];
    }

    // `state` from readGamepad; `playing` when a video is shown.
    return function step(state: ControllerState, { playing }: { playing: boolean }): ControllerAction[] {
        return stickActions(state, playing) ?? buttonActions(state, playing);
    };
}
