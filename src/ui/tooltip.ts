import { Component } from "@pmndrs/uikit";
import { Box3, Quaternion, Vector3 } from "three";
import type { Camera, Object3D } from "three";

import { MM, UI_SURFACE, uiLabel, uikitPanel, DRAW_ORDER } from "./uikit.ts";

// One tooltip for the whole scene: when the pointer rests on a component with
// a `tooltip` string, it shows that text just above the component, facing the
// same way, and sized for its distance so it reads the same near or far.
const FONT_SIZE = 0.05;
const REFERENCE_DISTANCE = 2;

const box = new Box3();
const center = new Vector3();
const cameraPosition = new Vector3();
const quaternion = new Quaternion();

// A component the pointer can rest on; a button from ui/uikit.ts has a
// tooltip.
export type TooltipTarget = Object3D & { tooltip?: string };

// Whether the target shows. uikit draws its components with meshes of its
// own and keeps the components themselves hidden, so it says on its own.
function shows(target: TooltipTarget): boolean {
    return target instanceof Component ? target.isVisible.value : target.visible;
}

export function createTooltip(scene: Object3D): (target: TooltipTarget | null, camera: Camera) => void {
    const text = uiLabel(" ", { fontSize: FONT_SIZE });
    // As wide as its text.
    const tooltip = uikitPanel(undefined, 0.09, {
        renderOrder: DRAW_ORDER.top,
        alignItems: "center",
        paddingX: 0.04 * MM,
        ...UI_SURFACE,
        borderRadius: 0.03 * MM,
        borderWidth: 0.004 * MM,
    });
    tooltip.add(text);
    tooltip.visible = false;
    scene.add(tooltip);

    let shownFor: TooltipTarget | null = null;

    // Call once per frame with the hovered component, or null.
    return function update(target: TooltipTarget | null, camera: Camera): void {
        if (!target || !target.tooltip || !shows(target)) {
            tooltip.visible = false;
            shownFor = null;
            return;
        }
        if (shownFor !== target) {
            shownFor = target;
            text.setProperties({ text: target.tooltip });
        }
        box.setFromObject(target);
        box.getCenter(center);
        target.getWorldQuaternion(quaternion);
        camera.getWorldPosition(cameraPosition);
        const scale = Math.max(center.distanceTo(cameraPosition) / REFERENCE_DISTANCE, 0.5);
        tooltip.quaternion.copy(quaternion);
        tooltip.scale.setScalar(scale);
        tooltip.position.set(center.x, box.max.y + 0.06 * scale, center.z);
        // Slightly toward the viewer, so it isn't hidden behind its panel.
        tooltip.position.lerp(cameraPosition, 0.02);
        tooltip.visible = true;
    };
}
