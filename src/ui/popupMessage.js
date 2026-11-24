import { Color } from "three";
import { Block, Text } from "./meshUi.js";

import { FONT } from "./kit.js";

// One line of text in front of the viewer, such as "Loading video...":
// show(message) shows it for `duration` ms, or until hidden with 0.
export function createPopupMessage(scene) {
    const text = new Text({
        content: "",
        fontSize: 0.07,
        offset: 0.035,
        fontColor: new Color(0xffffff),
    });
    const popup = new Block({
        width: 2,
        height: 0.2,
        justifyContent: "center",
        contentDirection: "row",
        padding: 0.02,
        borderRadius: 0,
        backgroundColor: new Color(0x5c5c5c),
        backgroundOpacity: 1,
        ...FONT,
    }).add(text);
    popup.position.set(0, 1, -2);
    popup.visible = false;
    scene.add(popup);

    let timeout;
    const hide = () => {
        clearTimeout(timeout);
        popup.visible = false;
    };
    const show = (message, duration = 4000) => {
        text.set({ content: String(message) });
        popup.visible = true;
        clearTimeout(timeout);
        if (duration > 0) {
            timeout = setTimeout(hide, duration);
        }
    };
    return { show, hide };
}
