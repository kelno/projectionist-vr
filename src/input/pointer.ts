import { Raycaster, Vector2 } from "three";

import ThreeMeshUI from "../ui/meshUi.ts";
import * as UI from "../UI.ts";

// The pointer: the mouse or a touch outside VR, the controller in use in VR.
// Each frame, update() finds what it points at among the components that
// can be clicked now (UI.objsToTest), and sets their states: "hovered" under
// the pointer, "selected" once per press, "idle" for the rest. It returns
// the component pointed at, if any.
//
// `hiddenSphere` surrounds everything to catch clicks outside the panels;
// `controller()` gives the number of the controller in use.
export function createPointer({ renderer, camera, vrControl, controller, hiddenSphere }) {
    const raycaster = new Raycaster();
    raycaster.layers.set(0);

    // In normalized device coordinates, -1 to 1; null when there is none.
    const mouse = new Vector2(null, null);
    let pressed = false;
    // What the current press selected: a press selects once, so coming back
    // over it during the same press doesn't fire it again (a button opening
    // a panel over itself would otherwise close it at once).
    let pressedOn;

    const press = () => {
        pressed = true;
    };
    const release = () => {
        pressed = false;
        pressedOn = undefined;
    };
    const moveTo = (x, y) => {
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
        mouse.set(null, null);
    });

    // The closest component the ray hits, with the hit's point and uv.
    function raycast() {
        let closest = null;
        for (const object of UI.objsToTest) {
            const [hit] = raycaster.intersectObject(object, true);
            if (hit && (!closest || hit.distance < closest.distance)) {
                closest = { ...hit, object };
            }
        }
        return closest;
    }

    function update() {
        let hit = null;
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
            target.uv = { x: hit.uv.x, y: hit.uv.y };
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
