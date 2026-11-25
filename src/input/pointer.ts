import { Component } from "@pmndrs/uikit";
import { Raycaster, Vector2 } from "three";
import type { Camera, Intersection, Object3D, WebGLRenderer } from "three";

import ThreeMeshUI from "../ui/meshUi.ts";
import * as UI from "../UI.ts";
import type { VRControls } from "../vr/VRControl.ts";
import { createUikitEvents, uikitHit } from "./uikitEvents.ts";

// The pointer: the mouse or a touch outside VR, the controller in use in VR.
// Each frame, update() finds what it points at among the components that
// can be clicked now (UI.objsToTest), and sets their states: "hovered" under
// the pointer, "selected" once per press, "idle" for the rest. It returns
// the component pointed at, if any. A uikit panel among them gets its
// events through uikitEvents.ts instead, and update() returns the innermost
// of its components with a tooltip.
//
// `hiddenSphere` surrounds everything to catch clicks outside the panels;
// `controller()` gives the number of the controller in use.
export interface Pointer {
    update(): Pointed | null;
    press(): void;
    release(): void;
}

// What the pointer rests on: a three-mesh-ui component, or a uikit one.
export type Pointed = UI.PointerTarget | (Component & { tooltip?: string; uv?: { x: number; y: number } });

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
    function withTooltip(object: Object3D): Pointed {
        for (let current: Object3D | null = object; current instanceof Component; current = current.parent) {
            if ((current as Component & { tooltip?: string }).tooltip) return current;
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
            // Where along it the pointer is, as for a three-mesh-ui block: the
            // seek bar reads it.
            (uikit.object as Pointed).uv = { x: uikit.uv.x, y: uikit.uv.y };
        }
        uikitEvents.hover(uikit);
        if (uikit && pressed && pressedOn === undefined) {
            pressedOn = uikit.object.uuid;
            uikitEvents.press();
        }

        const target = hit && !(hit.target instanceof Component) && hit.target.isUI ? hit.target : null;
        if (target) {
            // A target means a hit, and every mesh here has uvs.
            target.uv = { x: hit!.intersection.uv!.x, y: hit!.intersection.uv!.y };
            if (!pressed) {
                target.setState("hovered");
            } else if (pressedOn === undefined) {
                pressedOn = target.uuid;
                target.setState("selected");
            }
        }

        // Everything else goes idle. The hidden sphere isn't a Block but
        // must go idle too, or its next click is ignored as a repeat.
        for (const object of UI.objsToTest) {
            if (object === target) {
                continue;
            }
            if (object === hiddenSphere || (object instanceof ThreeMeshUI.Block && object.isUI)) {
                object.setState("idle");
            }
        }

        if (uikit) return withTooltip(uikit.object);
        return target === hiddenSphere ? null : target;
    }

    return { update, press, release };
}
