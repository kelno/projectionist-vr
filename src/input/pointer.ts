import { Raycaster, Vector2 } from "three";
import type { Camera, Intersection, WebGLRenderer } from "three";

import ThreeMeshUI from "../ui/meshUi.ts";
import * as UI from "../UI.ts";
import type { VRControls } from "../vr/VRControl.ts";

// The pointer: the mouse or a touch outside VR, the controller in use in VR.
// Each frame, update() finds what it points at among the components that
// can be clicked now (UI.objsToTest), and sets their states: "hovered" under
// the pointer, "selected" once per press, "idle" for the rest. It returns
// the component pointed at, if any.
//
// `hiddenSphere` surrounds everything to catch clicks outside the panels;
// `controller()` gives the number of the controller in use.
export interface Pointer {
    update(): UI.PointerTarget | null;
    press(): void;
    release(): void;
}

// What the ray hit: the component, and the point and uv of the hit.
type Hit = Intersection & { object: UI.PointerTarget };

// three.js types a Vector2's coordinates as numbers, but the mouse below
// holds null in both when there is no pointer, and update() checks for it.
const NO_POINTER = null as unknown as number;

export function createPointer({ renderer, camera, vrControl, controller, hiddenSphere }: {
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
    const release = () => {
        pressed = false;
        pressedOn = undefined;
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
        for (const object of UI.objsToTest) {
            const [hit] = raycaster.intersectObject(object, true);
            if (hit && (!closest || hit.distance < closest.distance)) {
                closest = { ...hit, object };
            }
        }
        return closest;
    }

    function update(): UI.PointerTarget | null {
        let hit: Hit | null = null;
        if (renderer.xr.isPresenting) {
            vrControl.setFromController(controller(), raycaster.ray);
            hit = raycast();
            // The dot at the end of the ray; not on the hidden sphere, where
            // the two eyes' dots would drift apart.
            if (hit && hit.object !== hiddenSphere) {
                vrControl.setPointerAt(controller(), hit.point);
            }
        } else if (mouse.x !== null && mouse.y !== null) {
            raycaster.setFromCamera(mouse, camera);
            hit = raycast();
        }

        const target = hit?.object.isUI ? hit.object : null;
        if (target) {
            // A target means a hit, and every mesh here has uvs.
            target.uv = { x: hit!.uv!.x, y: hit!.uv!.y };
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

        return target === hiddenSphere ? null : target;
    }

    return { update, press, release };
}
