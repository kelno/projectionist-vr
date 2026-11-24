import { TextureLoader } from "three";
import { Block, Text, InlineBlock } from "./meshUi.ts";

import FontJSON from "../../assets/fonts/Roboto-Regular-msdf.json";
import FontImage from "../../assets/fonts/Roboto-Regular.png";

import UpIcon from "../../assets/icons/up.png";
import DownIcon from "../../assets/icons/down.png";
import LeftIcon from "../../assets/icons/left.png";
import RightIcon from "../../assets/icons/right.png";

import { BORDER_WIDTH, SURFACE_OPACITY, colour } from "./theme.ts";

// What the controls do, shown by the help panel and, for the grip, by the
// popup above the controller while the grip is held. A row is either a
// thumbstick direction (`stick`) or a button (`key`), and what it does.
type StickDirection = "up" | "down" | "left" | "right";
export type Control =
    | { key: string; stick?: undefined; label: string }
    | { key?: undefined; stick: StickDirection[]; label: string };

export const LIBRARY_CONTROLS: Control[] = [
    { key: "TRIGGER", label: "Select" },
    { stick: ["left", "right"], label: "Page" },
    { key: "TRIGGER", label: "On the bar: move" },
];

export const PLAYER_CONTROLS: Control[] = [
    { stick: ["up", "down"], label: "Zoom" },
    { stick: ["left", "right"], label: "-10 s / +10 s" },
    { key: "A", label: "Play / pause" },
    { key: "B", label: "Library" },
    { key: "TRIGGER", label: "On video: menu" },
];

export const GRIP_PLAYER_CONTROLS: Control[] = [
    { stick: ["up", "down"], label: "Tilt" },
    { stick: ["left"], label: "Previous video" },
    { stick: ["right"], label: "Next video" },
    { key: "B", label: "Library" },
];

export const GRIP_LIBRARY_CONTROLS: Control[] = [{ key: "B", label: "Leave VR" }];

const STICK_ICONS = { up: UpIcon, down: DownIcon, left: LeftIcon, right: RightIcon };

const BADGE_WIDTH = 0.34;
const ROW_HEIGHT = 0.15;
const FONT_SIZE = 0.065;

const loader = new TextureLoader();

function makeBadge(control: Control): Block {
    const badge = new Block({
        width: BADGE_WIDTH,
        height: ROW_HEIGHT - 0.02,
        margin: 0.01,
        justifyContent: "center",
        contentDirection: "row",
        borderRadius: 0.06,
        backgroundColor: colour("raised"),
        backgroundOpacity: 1,
        fontColor: colour("text"),
    });
    if (control.key) {
        badge.add(new Text({ fontSize: FONT_SIZE, content: control.key }));
    } else {
        // A control without a key has a stick; every key above is non-empty.
        for (const direction of control.stick!) {
            const icon = new InlineBlock({
                width: 0.1,
                height: 0.1,
                backgroundOpacity: 0,
                borderRadius: 0,
            });
            badge.add(icon);
            loader.load(STICK_ICONS[direction], (texture) => {
                icon.set({ backgroundTexture: texture, backgroundOpacity: 1 });
            });
        }
    }
    return badge;
}

function makeRow(control: Control, width: number): Block {
    return new Block({
        width,
        height: ROW_HEIGHT,
        contentDirection: "row",
        justifyContent: "start",
        alignItems: "center",
        backgroundOpacity: 0,
    }).add(
        makeBadge(control),
        new Block({
            width: width - BADGE_WIDTH - 0.04,
            height: ROW_HEIGHT,
            justifyContent: "center",
            textAlign: "left",
            padding: 0.02,
            backgroundOpacity: 0,
        }).add(new Text({ fontSize: FONT_SIZE, content: control.label }))
    );
}

// A titled column of control rows.
export function makeControlsColumn(title: string, controls: Control[], width: number): Block {
    const column = new Block({
        width,
        height: 0.15 + ROW_HEIGHT * Math.max(controls.length, 5),
        contentDirection: "column",
        justifyContent: "start",
        padding: 0.02,
        backgroundOpacity: 0,
        fontFamily: FontJSON,
        fontTexture: FontImage,
        fontColor: colour("text"),
    });
    column.add(
        new Block({
            width: width - 0.04,
            height: 0.13,
            justifyContent: "center",
            textAlign: "left",
            backgroundOpacity: 0,
            fontColor: colour("heading"),
        }).add(new Text({ fontSize: 0.075, content: title }))
    );
    for (const control of controls) {
        column.add(makeRow(control, width - 0.04));
    }
    return column;
}

// The popup shown above the controller while its grip is held: one for the
// player, one for the library.
export function makeGripPopup(controls: Control[]): Block {
    const popup = new Block({
        width: 1.3,
        height: 0.2 + ROW_HEIGHT * controls.length,
        contentDirection: "column",
        justifyContent: "center",
        padding: 0.04,
        borderRadius: 0.06,
        backgroundColor: colour("surface"),
        backgroundOpacity: SURFACE_OPACITY,
        // Shown scaled down, close to the eyes, above the controller: a wider
        // edge gives it the same look as the panels..
        borderWidth: BORDER_WIDTH * 3,
        borderColor: colour("border"),
        borderOpacity: 1,
        fontFamily: FontJSON,
        fontTexture: FontImage,
        fontColor: colour("text"),
    });
    popup.add(
        new Block({
            width: 1.2,
            height: 0.11,
            justifyContent: "center",
            textAlign: "left",
            backgroundOpacity: 0,
            fontColor: colour("heading"),
        }).add(new Text({ fontSize: 0.07, content: "HOLD GRIP +" }))
    );
    for (const control of controls) {
        popup.add(makeRow(control, 1.2));
    }
    return popup;
}
