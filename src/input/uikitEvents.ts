import { Component as UikitComponent } from "@pmndrs/uikit";
import type { Intersection, Object3D } from "three";

// Any uikit component, whatever its properties.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Component = UikitComponent<any>;

// uikit's components react to three.js events sent to them: pointerenter and
// pointerleave for their hover look, pointerdown and pointerup for their
// pressed look, click for their action. @pmndrs/pointer-events would send
// them; the player's pointer (pointer.ts) sends them through this instead.
// Events don't bubble in three.js, so each goes to the component hit and to
// every uikit component holding it, innermost first, as in a web page, until
// one stops it.
//
// The click is sent on the press, not the release: three-mesh-ui's buttons
// act on the press too, and a press selects once (pointer.ts).

const POINTER_ID = 1;

type EventType = "pointerenter" | "pointerleave" | "pointerdown" | "pointerup" | "click";

// The closest of `hits` that a uikit component takes events for. uikit's own
// meshes, which draw the panels and glyphs, take none, nor do hidden components.
export function uikitHit(hits: Intersection[]): Intersection | undefined {
    return hits.find((hit) => hit.object instanceof UikitComponent && hit.object.pointerEvents !== "none");
}

// The component hit and the uikit components holding it, innermost first.
function chainOf(object: Object3D | undefined): Component[] {
    const chain: Component[] = [];
    for (let current = object ?? null; current instanceof UikitComponent; current = current.parent) {
        chain.push(current);
    }
    return chain;
}

// Sends `type` to each of `components` in turn, until one stops it.
function send(components: Component[], type: EventType, hit: Intersection | undefined): void {
    let stopped = false;
    const stop = () => {
        stopped = true;
    };
    for (const component of components) {
        // An event is the hit, as @pmndrs/pointer-events sends it; a leave
        // after the pointer moved off everything has no hit, only the object.
        const event = {
            ...(hit ?? { distance: Infinity, point: component.position, object: component }),
            pointerId: POINTER_ID,
            stopPropagation: stop,
            stopImmediatePropagation: stop,
        };
        component.dispatchEvent({ type, ...event });
        if (stopped) {
            return;
        }
    }
}

export interface UikitEvents {
    // Each frame, with the uikit hit under the pointer, if any.
    hover(hit: Intersection | undefined): void;
    // When a press starts on the hovered component.
    press(): void;
    // When the press ends.
    release(): void;
}

export function createUikitEvents(): UikitEvents {
    let hit: Intersection | undefined;
    let hovered: Component[] = [];
    let pressed: Component[] = [];

    return {
        hover(newHit) {
            hit = newHit;
            const chain = chainOf(hit?.object);
            const left = hovered.filter((component) => !chain.includes(component));
            const entered = chain.filter((component) => !hovered.includes(component));
            // Enter and leave don't bubble: each component gets its own.
            for (const component of left) send([component], "pointerleave", undefined);
            for (const component of entered) send([component], "pointerenter", hit);
            hovered = chain;
        },
        press() {
            pressed = hovered;
            send(pressed, "pointerdown", hit);
            send(pressed, "click", hit);
        },
        release() {
            send(pressed, "pointerup", hit);
            pressed = [];
        },
    };
}
