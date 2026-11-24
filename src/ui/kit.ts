import { TextureLoader } from "three";
import { Block, Text, InlineBlock } from "./meshUi.ts";

import FontJSON from "../../assets/fonts/Roboto-Regular-msdf.json";
import FontImage from "../../assets/fonts/Roboto-Regular.png";

import { BORDER_WIDTH, RADIUS, SURFACE_OPACITY, colour, space, textOn } from "./theme.ts";

// The building blocks of the player's panels, in the theme's look (theme.js):
// buttons, labels, rows and panels. A button carries its tooltip and its
// action; whoever shows it registers it as a raycast target.

const loader = new TextureLoader();

export const FONT = { fontFamily: FontJSON, fontTexture: FontImage };

export const BUTTON_SIZE = 0.15;

// A button's look in each state: raised when idle, lighter under the pointer,
// the accent colour while pressed. Each is a function, since three-mesh-ui
// keeps the Color objects it's given.
const buttonLook = (background) => ({
    offset: 0.035,
    backgroundColor: colour(background),
    backgroundOpacity: 1,
    fontColor: textOn(background),
});

// `onRelease`, if given, runs when the press ends, as a drag handle needs.
// `hovered` is the colour under the pointer, such as "danger" for the power
// button.
function makeButton(block, { tooltip, onSelect, onRelease, hovered = "hovered" }) {
    block.tooltip = tooltip;
    block.idleAttributes = buttonLook("raised");
    block.setupState({
        state: "selected",
        attributes: { ...buttonLook("accent"), offset: 0.02 },
        onSet: onSelect,
    });
    block.setupState({ state: "hovered", attributes: buttonLook(hovered), onSet: onRelease });
    block.setupState({ state: "idle", attributes: block.idleAttributes, onSet: onRelease });
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

// A button showing an icon: a square with the corners every button has, or
// a circle when `round`; `setIcon(icon)` changes the icon, as the play button
// does between play and pause.
export function iconButton({ icon, tooltip, onSelect, onRelease, size = BUTTON_SIZE, hovered, round = false }) {
    // The icon's place is kept from the start, empty until its image loads:
    // adding it later would change the layout.
    const image = new InlineBlock({
        width: size * 0.7,
        height: size * 0.7,
        backgroundOpacity: 0,
        borderRadius: 0,
    });
    const button = new Block({
        width: size,
        height: size,
        justifyContent: "center",
        offset: 0.05,
        margin: space(1),
        borderRadius: round ? size / 2 : RADIUS.button,
        ...buttonLook("raised"),
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
    return makeButton(button, { tooltip, onSelect, onRelease, hovered });
}

// A text button; `text` is returned too, for buttons whose label changes. A
// label too long for the button shrinks to fit.
export function textButton({
    label,
    tooltip,
    onSelect,
    width = 0.55,
    height = BUTTON_SIZE,
    fontSize = 0.07,
}) {
    const text = new Text({ content: label, fontSize });
    const button = new Block({
        width,
        height,
        justifyContent: "center",
        contentDirection: "row",
        offset: 0.05,
        margin: space(1),
        borderRadius: RADIUS.button,
        bestFit: "shrink",
        ...FONT,
        ...buttonLook("raised"),
    }).add(text);
    makeButton(button, { tooltip, onSelect });
    button.text = text;
    return button;
}

// A bar to hold the trigger on and move something: it starts the drag when
// pressed and stops it when the press ends.
export function dragHandle({ width, height, tooltip, onStart, onStop }) {
    const look = (background) => ({ backgroundColor: colour(background), backgroundOpacity: 1 });
    const handle = new Block({
        width,
        height,
        justifyContent: "center",
        padding: space(1),
        borderRadius: Math.min(RADIUS.button, height / 2),
        ...look("raised"),
    });
    handle.tooltip = tooltip;
    handle.setupState({ state: "selected", attributes: look("accent"), onSet: onStart });
    handle.setupState({ state: "hovered", attributes: look("hovered"), onSet: onStop });
    handle.setupState({ state: "idle", attributes: look("raised"), onSet: onStop });
    return handle;
}

// Text with no background; `align` is "left", "center" or "right", `color`
// a theme colour's name.
export function label(content, { width, height = BUTTON_SIZE, fontSize = 0.06, align = "left", color = "text" }) {
    const text = new Text({ content, fontSize });
    const block = new Block({
        width,
        height,
        justifyContent: "center",
        textAlign: align,
        padding: space(0.5),
        backgroundOpacity: 0,
        fontColor: colour(color),
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

// The look of a window or panel's background, for panels built by hand.
export const SURFACE = {
    get backgroundColor() {
        return colour("surface");
    },
    backgroundOpacity: SURFACE_OPACITY,
    borderRadius: RADIUS.panel,
    borderWidth: BORDER_WIDTH,
    get borderColor() {
        return colour("border");
    },
    borderOpacity: 1,
};

// A window's background. A click on it is inside the window and does
// nothing, so it doesn't count as a click outside, which closes it.
export function panel(children, { width, height, padding = space(2), justify = "start" }) {
    const block = withChildren(new Block({
        width,
        height,
        contentDirection: "column",
        justifyContent: justify,
        padding,
        ...SURFACE,
        ...FONT,
    }), children);
    block.setupState({ state: "selected" });
    block.setupState({ state: "hovered" });
    block.setupState({ state: "idle" });
    return block;
}

// Shows a button as on, such as the current sort (the accent colour by
// default) or the mute button while muted ("danger"), until it is marked off
// again.
export function markActive(button, active, { color = "accent" } = {}) {
    const attributes = active
        ? { ...button.idleAttributes, backgroundColor: colour(color), fontColor: textOn(color) }
        : button.idleAttributes;
    button.setupState({ state: "idle", attributes });
    button.set(attributes);
}

// A thin line across a window, between sections that aren't the same kind
// of thing, such as settings and information.
export function divider(width) {
    const line = new Block({
        width,
        height: BORDER_WIDTH,
        borderRadius: 0,
        backgroundColor: colour("border"),
        backgroundOpacity: 1,
    });
    return withChildren(new Block({
        width,
        height: space(3),
        justifyContent: "center",
        backgroundOpacity: 0,
        ...FONT,
    }), [line]);
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
