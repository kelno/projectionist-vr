import { Box3, Color, Quaternion, Vector3 } from "three";
import { Block, Text } from "./meshUi.js";

import FontJSON from "../../assets/fonts/Roboto-Regular-msdf.json";
import FontImage from "../../assets/fonts/Roboto-Regular.png";

// One tooltip for the whole scene: when the pointer rests on a component with
// a `tooltip` string, it shows that text just above the component, facing the
// same way, and sized for its distance so it reads the same near or far.
const FONT_SIZE = 0.05;
const CHAR_WIDTH = 0.028;
const REFERENCE_DISTANCE = 2;

const box = new Box3();
const center = new Vector3();
const cameraPosition = new Vector3();
const quaternion = new Quaternion();

export function createTooltip(scene) {
    const text = new Text({ fontSize: FONT_SIZE, content: " " });
    const tooltip = new Block({
        width: 0.3,
        height: 0.09,
        justifyContent: "center",
        borderRadius: 0.03,
        backgroundColor: new Color(0x000000),
        backgroundOpacity: 0.85,
        fontFamily: FontJSON,
        fontTexture: FontImage,
        fontColor: new Color(0xffffff),
    }).add(text);
    tooltip.visible = false;
    scene.add(tooltip);

    let shownFor = null;

    // Call once per frame with the hovered component, or null.
    return function update(target, camera) {
        if (!target || !target.tooltip || !target.visible) {
            tooltip.visible = false;
            shownFor = null;
            return;
        }
        if (shownFor !== target) {
            shownFor = target;
            text.set({ content: target.tooltip });
            tooltip.set({ width: target.tooltip.length * CHAR_WIDTH + 0.08 });
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
