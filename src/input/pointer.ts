import { Component } from "@pmndrs/uikit";
import { Raycaster, Vector2 } from "three";
import type { Camera, Intersection, Object3D, WebGLRenderer } from "three";

import * as UI from "../UI.ts";
import type { VRControls } from "../vr/VRControl.ts";
import { createUikitEvents, uikitHit } from "./uikitEvents.ts";

// The pointer: the mouse or a touch outside VR, the controller in use in VR.
// Each frame, update() finds what it points at among the panels that can be
// clicked now (UI.objsToTest), sends their components its events
// (uikitEvents.ts), and returns the innermost component pointed at with a
// tooltip, if any. The hidden sphere gets states instead (UI.ts).
//
// `hiddenSphere` surrounds everything to catch clicks outside the panels;
// `controller()` gives the number of the controller in use.
export interface Pointer {
    update(): Pointed | null;
    press(): void;
    release(): void;
}

// What the pointer rests on: a uikit component.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Pointed = Component<any> & { tooltip?: string };

// What the ray hit: the raycast target it belongs to, and the hit itself,
// whose object is the target or, in a uikit panel, one of its components.
interface Hit {
    target: UI.PointerTarget;
    intersection: Intersection;
}

// three.js types a Vector2's coordinates as numbers, but the mouse below
// holds null in both when there is no pointer, and update() checks for it.
const NO_POINTER = null as unknown as number;

export function createPointer({
    renderer,
    camera,
    vrControl,
    controller,
    hiddenSphere,
}: {
    renderer: WebGLRenderer;
    camera: Camera;
    vrControl: VRControls;
    controller: () => number;
    hiddenSphere: UI.HiddenSphereMesh;
}): Pointer {
    const raycaster = new Raycaster();
    raycaster.layers.set(0);

    // In normalized device coordinates, -1 to 1; null when there is none.
    const mouse = new Vector2(NO_POINTER, NO_POINTER);
    let pressed = false;
    // What the current press selected: a press selects once, so coming back
    // over it during the same press doesn't fire it again (a button opening
    // a panel over itself would otherwise close it at once).
    let pressedOn: string | undefined;

    const press = () => {
        pressed = true;
    };
    const uikitEvents = createUikitEvents();

    const release = () => {
        pressed = false;
        pressedOn = undefined;
        uikitEvents.release();
    };
    const moveTo = (x: number, y: number) => {
        mouse.x = (x / window.innerWidth) * 2 - 1;
        mouse.y = -(y / window.innerHeight) * 2 + 1;
    };

    window.addEventListener("pointermove", (event) => moveTo(event.clientX, event.clientY));
    window.addEventListener("pointerdown", press);
    window.addEventListener("pointerup", release);
    window.addEventListener("touchstart", (event) => {
        press();
        moveTo(event.touches[0].clientX, event.touches[0].clientY);
    });
    window.addEventListener("touchend", () => {
        release();
        mouse.set(NO_POINTER, NO_POINTER);
    });

    // The closest component the ray hits, with the hit's point and uv.
    function raycast(): Hit | null {
        let closest: Hit | null = null;
        for (const target of UI.objsToTest) {
            const intersection =
                target instanceof Component ? uikitHit(raycaster, target) : raycaster.intersectObject(target, true)[0];
            if (intersection && (!closest || intersection.distance < closest.intersection.distance)) {
                closest = { target, intersection };
            }
        }
        return closest;
    }

    // The innermost uikit component from `object` out with a tooltip, or
    // `object` itself.
    function withTooltip(object: Pointed): Pointed {
        for (let current: Object3D | null = object; current instanceof Component; current = current.parent) {
            if ((current as Pointed).tooltip) return current;
        }
        return object;
    }

    function update(): Pointed | null {
        let hit: Hit | null = null;
        if (renderer.xr.isPresenting) {
            vrControl.setFromController(controller(), raycaster.ray);
            hit = raycast();
            // The dot at the end of the ray; not on the hidden sphere, where
            // the two eyes' dots would drift apart.
            if (hit && hit.target !== hiddenSphere) {
                vrControl.setPointerAt(controller(), hit.intersection.point);
            }
        } else if (mouse.x !== null && mouse.y !== null) {
            raycaster.setFromCamera(mouse, camera);
            hit = raycast();
        }

        const uikit = hit?.target instanceof Component ? hit.intersection : undefined;
        if (uikit?.uv) {
            // Where along it the pointer is: the seek bar reads it.
            (uikit.object as { uv?: { x: number; y: number } }).uv = { x: uikit.uv.x, y: uikit.uv.y };
        }
        uikitEvents.hover(uikit);
        if (uikit && pressed && pressedOn === undefined) {
            pressedOn = uikit.object.uuid;
            uikitEvents.press();
        }

        // The hidden sphere goes idle when not under the pointer, or its
        // next click would be ignored as a repeat.
        if (hit?.target === hiddenSphere) {
            if (!pressed) {
                hiddenSphere.setState("hovered");
            } else if (pressedOn === undefined) {
                pressedOn = hiddenSphere.uuid;
                hiddenSphere.setState("selected");
            }
        } else {
            hiddenSphere.setState("idle");
        }

        return uikit ? withTooltip(uikit.object as Pointed) : null;
    }

    return { update, press, release };
}
