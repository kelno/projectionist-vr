import { Color, TextureLoader } from "three";
import { Block, Text, InlineBlock } from "./meshUi.js";

import FontJSON from "../../assets/fonts/Roboto-Regular-msdf.json";
import FontImage from "../../assets/fonts/Roboto-Regular.png";

// The building blocks of the player's panels: buttons with the player's look
// (grey, yellow when hovered), labels and rows. A button carries its tooltip
// and its action; whoever shows it registers it as a raycast target.

const loader = new TextureLoader();

export const FONT = { fontFamily: FontJSON, fontTexture: FontImage };

export const BUTTON_SIZE = 0.15;

const idleAttributes = {
    offset: 0.035,
    backgroundColor: new Color(0x999999),
    backgroundOpacity: 1,
    fontColor: new Color(0xffffff),
};
// Text buttons are darker, for their white label to read well.
const textIdleAttributes = {
    ...idleAttributes,
    backgroundColor: new Color(0x4f4f4f),
};
const hoveredAttributes = {
    offset: 0.035,
    backgroundColor: new Color(0xffff00),
    backgroundOpacity: 1,
    fontColor: new Color(0x000000),
};
const selectedAttributes = {
    offset: 0.02,
    backgroundColor: new Color(0x777777),
    backgroundOpacity: 1,
    fontColor: new Color(0x222222),
};

// `onRelease`, if given, runs when the press ends, as a drag handle needs.
function makeButton(block, { tooltip, onSelect, onRelease, idle = idleAttributes }) {
    block.tooltip = tooltip;
    block.idleAttributes = idle;
    block.setupState({
        state: "selected",
        attributes: selectedAttributes,
        onSet: onSelect,
    });
    block.setupState({ state: "hovered", attributes: hoveredAttributes, onSet: onRelease });
    block.setupState({ state: "idle", attributes: idle, onSet: onRelease });
    return block;
}

// Each image is loaded once, however many buttons show it.
const textures = new Map();

export function loadTexture(url) {
    if (!textures.has(url)) {
        textures.set(url, loader.loadAsync(url));
    }
    return textures.get(url);
}

// A round button showing an icon; `setIcon(icon)` changes it, as the play
// button does between play and pause.
export function iconButton({ icon, tooltip, onSelect, onRelease, size = BUTTON_SIZE }) {
    // The icon's place is kept from the start, empty until its image loads:
    // adding it later would change the layout.
    const image = new InlineBlock({
        width: size * 0.8,
        height: size * 0.8,
        backgroundOpacity: 0,
        borderRadius: 0,
    });
    const button = new Block({
        width: size,
        height: size,
        justifyContent: "center",
        offset: 0.05,
        margin: 0.02,
        borderRadius: size / 2,
        ...idleAttributes,
    }).add(image);

    let shown = null;
    button.setIcon = (url) => {
        if (url === shown) {
            return;
        }
        shown = url;
        loadTexture(url).then((texture) => {
            if (shown === url) {
                image.set({ backgroundTexture: texture, backgroundOpacity: 1 });
            }
        });
    };
    button.setIcon(icon);
    return makeButton(button, { tooltip, onSelect, onRelease });
}

// A text button, with an optional icon after the label (such as an arrow for
// a button leading to a sub-page); `text` is returned too, for buttons whose
// label changes. A label too long for the button shrinks to fit.
export function textButton({
    label,
    tooltip,
    onSelect,
    width = 0.55,
    height = BUTTON_SIZE,
    fontSize = 0.07,
    icon = null,
}) {
    const text = new Text({ content: label, fontSize });
    const button = new Block({
        width,
        height,
        justifyContent: "center",
        contentDirection: "row",
        offset: 0.05,
        margin: 0.02,
        borderRadius: 0.08,
        bestFit: "shrink",
        ...FONT,
        ...textIdleAttributes,
    }).add(text);
    if (icon) {
        const image = new InlineBlock({
            width: fontSize,
            height: fontSize,
            margin: 0.02,
            backgroundOpacity: 0,
            borderRadius: 0,
        });
        button.add(image);
        loadTexture(icon).then((texture) => {
            image.set({ backgroundTexture: texture, backgroundOpacity: 1 });
        });
    }
    makeButton(button, { tooltip, onSelect, idle: textIdleAttributes });
    button.text = text;
    return button;
}

// A bar to hold the trigger on and move something: it starts the drag when
// pressed and stops it when the press ends.
export function dragHandle({ width, height, tooltip, onStart, onStop }) {
    const idle = { backgroundColor: new Color(0x5c5c5c), backgroundOpacity: 1 };
    const handle = new Block({
        width,
        height,
        justifyContent: "center",
        padding: 0.02,
        borderRadius: height * 0.6,
        ...idle,
    });
    handle.tooltip = tooltip;
    handle.setupState({ state: "selected", onSet: onStart });
    handle.setupState({
        state: "hovered",
        attributes: { backgroundColor: new Color(0xffff00), backgroundOpacity: 1 },
        onSet: onStop,
    });
    handle.setupState({ state: "idle", attributes: idle, onSet: onStop });
    return handle;
}

// Text with no background; `align` is "left", "center" or "right".
export function label(content, { width, height = BUTTON_SIZE, fontSize = 0.06, align = "left", color = 0xffffff }) {
    const text = new Text({ content, fontSize });
    const block = new Block({
        width,
        height,
        justifyContent: "center",
        textAlign: align,
        padding: 0.01,
        backgroundOpacity: 0,
        fontColor: new Color(color),
        ...FONT,
    }).add(text);
    block.text = text;
    return block;
}

// Block.add() with no argument logs an error, so add only what there is.
function withChildren(block, children) {
    if (children.length > 0) {
        block.add(...children);
    }
    return block;
}

export function row(children, { width, height = BUTTON_SIZE + 0.04, justify = "start" }) {
    return withChildren(new Block({
        width,
        height,
        contentDirection: "row",
        justifyContent: justify,
        alignItems: "center",
        backgroundOpacity: 0,
        ...FONT,
    }), children);
}

// A window's background: dark and rounded. A click on it is inside the window
// and does nothing, so it doesn't count as a click outside, which closes it.
export function panel(children, { width, height, padding = 0.04, justify = "start" }) {
    const block = withChildren(new Block({
        width,
        height,
        contentDirection: "column",
        justifyContent: justify,
        padding,
        borderRadius: 0.06,
        backgroundColor: new Color(0x1e1e1e),
        backgroundOpacity: 1,
        ...FONT,
    }), children);
    block.setupState({ state: "selected" });
    block.setupState({ state: "hovered" });
    block.setupState({ state: "idle" });
    return block;
}

// Shows a button as on, such as the current sort (teal by default) or the
// mute button while muted (red), until it is marked off again.
export function markActive(button, active, { color = 0x008e7f } = {}) {
    const attributes = active
        ? { ...button.idleAttributes, backgroundColor: new Color(color) }
        : button.idleAttributes;
    button.setupState({ state: "idle", attributes });
    button.set(attributes);
}

export function column(children, { width, height, justify = "start" }) {
    return withChildren(new Block({
        width,
        height,
        contentDirection: "column",
        justifyContent: justify,
        backgroundOpacity: 0,
        ...FONT,
    }), children);
}
