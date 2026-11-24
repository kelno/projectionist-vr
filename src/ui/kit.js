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

function makeButton(block, { tooltip, onSelect }) {
    block.tooltip = tooltip;
    block.setupState({
        state: "selected",
        attributes: selectedAttributes,
        onSet: onSelect,
    });
    block.setupState({ state: "hovered", attributes: hoveredAttributes });
    block.setupState({ state: "idle", attributes: idleAttributes });
    return block;
}

export function iconButton({ icon, tooltip, onSelect, size = BUTTON_SIZE }) {
    const button = new Block({
        width: size,
        height: size,
        justifyContent: "center",
        offset: 0.05,
        margin: 0.02,
        borderRadius: size / 2,
        ...idleAttributes,
    });
    loader.load(icon, (texture) => {
        button.add(
            new InlineBlock({
                width: size * 0.66,
                height: size * 0.66,
                backgroundTexture: texture,
                borderRadius: 0,
            })
        );
    });
    return makeButton(button, { tooltip, onSelect });
}

// A text button, with an optional icon after the label (such as an arrow for
// a button leading to a sub-page); `text` is returned too, for buttons whose
// label changes.
export function textButton({ label, tooltip, onSelect, width = 0.55, fontSize = 0.07, icon = null }) {
    const text = new Text({ content: label, fontSize });
    const button = new Block({
        width,
        height: BUTTON_SIZE,
        justifyContent: "center",
        offset: 0.05,
        margin: 0.02,
        borderRadius: 0.08,
        ...FONT,
        ...idleAttributes,
    }).add(text);
    if (icon) {
        loader.load(icon, (texture) => {
            button.add(
                new InlineBlock({
                    width: fontSize,
                    height: fontSize,
                    margin: 0.02,
                    backgroundTexture: texture,
                    borderRadius: 0,
                })
            );
        });
    }
    makeButton(button, { tooltip, onSelect });
    button.text = text;
    return button;
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
