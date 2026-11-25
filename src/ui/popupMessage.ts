import type { Object3D } from "three";

import { sanitizeFontText } from "../font.ts";
import { space } from "./theme.ts";
import { MM, UI_SURFACE, uiLabel, uikitPanel, DRAW_ORDER } from "./uikit.ts";

// One line of text in front of the viewer, such as "Loading video...":
// show(message) shows it for `duration` ms, or until hidden with 0.
export interface PopupMessage {
    show(message: unknown, duration?: number): void;
    hide(): void;
}

export function createPopupMessage(scene: Object3D): PopupMessage {
    const text = uiLabel("", { fontSize: 0.07 });
    // As wide as its text, at least 2 m.
    const popup = uikitPanel(undefined, 0.2, {
        renderOrder: DRAW_ORDER.top,
        minWidth: 2 * MM,
        alignItems: "center",
        justifyContent: "center",
        paddingX: space(3) * MM,
        ...UI_SURFACE,
    });
    popup.add(text);
    popup.position.set(0, 1, -2);
    popup.visible = false;
    scene.add(popup);

    let timeout: ReturnType<typeof setTimeout> | undefined;
    const hide = () => {
        clearTimeout(timeout);
        popup.visible = false;
    };
    const show = (message: unknown, duration = 4000) => {
        text.setProperties({ text: sanitizeFontText(message) });
        popup.visible = true;
        clearTimeout(timeout);
        if (duration > 0) {
            timeout = setTimeout(hide, duration);
        }
    };
    return { show, hide };
}
