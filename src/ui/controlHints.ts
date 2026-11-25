import { Container, Image as UiImage } from "@pmndrs/uikit";
import { Group } from "three";

import UpIcon from "../../assets/icons/up.png";
import DownIcon from "../../assets/icons/down.png";
import LeftIcon from "../../assets/icons/left.png";
import RightIcon from "../../assets/icons/right.png";

import { BORDER_WIDTH, colour } from "./theme.ts";
import { MM, UI_SURFACE, uiLabel, uikitPanel, DRAW_ORDER } from "./uikit.ts";

// What the controls do, shown by the help panel and, for the grip, by the
// popup above the controller while the grip is held. A row is either a
// thumbstick direction (`stick`) or a button (`key`), and what it does.
type StickDirection = "up" | "down" | "left" | "right";
export type Control =
    { key: string; stick?: undefined; label: string } | { key?: undefined; stick: StickDirection[]; label: string };

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

function makeBadge(control: Control): Container {
    const badge = new Container({
        width: BADGE_WIDTH * MM,
        height: (ROW_HEIGHT - 0.02) * MM,
        margin: 0.01 * MM,
        flexShrink: 0,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 0.06 * MM,
        backgroundColor: colour("raised"),
    });
    if (control.key) {
        badge.add(uiLabel(control.key, { fontSize: FONT_SIZE }));
    } else {
        // A control without a key has a stick; every key above is non-empty.
        for (const direction of control.stick!) {
            badge.add(new UiImage({ src: STICK_ICONS[direction], width: 0.1 * MM, height: 0.1 * MM }));
        }
    }
    return badge;
}

function makeRow(control: Control): Container {
    const row = new Container({
        height: ROW_HEIGHT * MM,
        flexShrink: 0,
        flexDirection: "row",
        alignItems: "center",
        gapColumn: 0.03 * MM,
    });
    row.add(makeBadge(control), uiLabel(control.label, { fontSize: FONT_SIZE }));
    return row;
}

function heading(title: string, fontSize: number): ReturnType<typeof uiLabel> {
    const text = uiLabel(title, { fontSize, color: "heading" });
    text.setProperties({ marginBottom: 0.02 * MM });
    return text;
}

// A titled column of control rows, `width` metres wide.
export function makeControlsColumn(title: string, controls: Control[], width: number): Container {
    const column = new Container({
        width: width * MM,
        flexShrink: 0,
        flexDirection: "column",
        padding: 0.02 * MM,
    });
    column.add(heading(title, 0.075), ...controls.map(makeRow));
    return column;
}

// The popup shown above the controller while its grip is held: one for the
// player, one for the library. The panel sits in a group, which is what
// moves from one controller to the other: a uikit panel moved to another
// parent loses its backgrounds.
export function makeGripPopup(controls: Control[]): Group {
    const popup = uikitPanel(1.3, undefined, {
        renderOrder: DRAW_ORDER.top,
        flexDirection: "column",
        padding: 0.04 * MM,
        ...UI_SURFACE,
        borderRadius: 0.06 * MM,
        // Shown scaled down, close to the eyes, above the controller: a wider
        // edge gives it the same look as the panels.
        borderWidth: BORDER_WIDTH * 3 * MM,
    });
    popup.add(heading("HOLD GRIP +", 0.07), ...controls.map(makeRow));
    const group = new Group();
    group.add(popup);
    return group;
}
