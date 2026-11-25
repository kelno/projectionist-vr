import {
    Component as UikitComponent,
    Container,
    Image as UiImage,
    Text,
    reversePainterSortStable,
} from "@pmndrs/uikit";
import type { Component, ContainerProperties } from "@pmndrs/uikit";
import { signal } from "@preact/signals-core";
import type { Signal } from "@preact/signals-core";
import type { Color, Object3D, WebGLRenderer } from "three";

import { asPointerEvent } from "../input/uikitEvents.ts";
import { BORDER_WIDTH, RADIUS, colour, space } from "./theme.ts";
import type { ColourName } from "./theme.ts";

import FontJSON from "../../assets/fonts/Roboto-Regular-msdf.json";
import FontImage from "../../assets/fonts/Roboto-Regular.png";

// @pmndrs/uikit draws the player's panels. They need two renderer settings
// (setupUikit), and each panel an update every frame (updateUikit), which
// lays it out and loads its fonts.

// Lengths in uikit are in "pixels"; at this size one is a millimetre, so a
// length in metres from the theme is that times 1000.
export const MM = 1000;

// The usual height of a button, in metres.
export const BUTTON_SIZE = 0.15;

const roots = new Set<Container>();

// The player's own MSDF Roboto, with its image's address from the build.
// uikit's bundled Roboto would add about 400 KB to the bundle, in four weights
// but not the regular one, with no more accents. The font has no space glyph,
// which uikit takes from the font: an empty glyph a quarter of the font's
// size wide, as in Roboto, stands in for it.
const SPACE = {
    id: 32,
    index: 0,
    char: " ",
    width: 0,
    height: 0,
    xoffset: 0,
    yoffset: 0,
    chnl: 15,
    x: 0,
    y: 0,
    page: 0,
};
const roboto = {
    normal: {
        ...FontJSON,
        info: { ...FontJSON.info, outline: 0 },
        chars: [...FontJSON.chars, { ...SPACE, xadvance: Math.round(FontJSON.info.size / 4) }],
        pages: [FontImage],
    },
};

export function setupUikit(renderer: WebGLRenderer): void {
    // Without these, content clipped by its parent draws outside it, and
    // panels and text are drawn in the wrong order and flicker.
    renderer.localClippingEnabled = true;
    renderer.setTransparentSort(reversePainterSortStable);
}

// A panel of `width` by `height` metres, centred on its position (or on
// the edge its `anchorX` and `anchorY` name), in the player's font; it gets
// its update every frame. Without a width or height, it fits its content.
export function uikitPanel(
    width: number | undefined,
    height: number | undefined,
    properties: ContainerProperties = {},
): Container {
    const root = new Container({
        ...(width === undefined ? {} : { width: width * MM }),
        ...(height === undefined ? {} : { height: height * MM }),
        pixelSize: 1 / MM,
        fontFamilies: { roboto },
        fontFamily: "roboto",
        ...properties,
    });
    roots.add(root);
    return root;
}

// Call once per frame with the milliseconds since the last one.
export function updateUikit(delta: number): void {
    for (const root of roots) {
        root.update(delta);
    }
}

// Takes `component` out of its panel and frees it and everything in it.
export function disposeUi(component: Object3D): void {
    const components: { dispose(): void }[] = [];
    component.traverse((object) => {
        if (object instanceof UikitComponent) components.push(object);
    });
    for (const each of components.reverse()) {
        each.dispose();
    }
}

////////////////////////////////////////////////////////////////////////////////
// The building blocks of the panels, in the theme's look: buttons, labels,
// rows. The pointer sends them its events (input/uikitEvents.ts); a component
// with a `tooltip` shows it while pointed at (ui/tooltip.ts).

// The look of a window or panel's background.
export const UI_SURFACE: ContainerProperties = {
    borderRadius: RADIUS.panel * MM,
    borderWidth: BORDER_WIDTH * MM,
    borderColor: colour("border"),
    backgroundColor: colour("surface"),
    color: colour("text"),
};

// A button: `tooltip` is shown while it's pointed at; `idle` is its colours
// while not pointed at, which uiMarkActive() changes.
export type UiButton = Container & { tooltip: string | undefined; idle: ButtonColours };

// A button's colours while not pressed, as signals: uikit follows a
// signal's changes by itself, whereas setProperties() during a press leaves
// the button in its pressed look. `hover` is its background under the
// pointer, normally `restHover`.
interface ButtonColours {
    background: Signal<Color>;
    text: Signal<Color>;
    hover: Signal<Color>;
    restHover: ColourName;
}
// A button showing an icon; setIcon(url) changes the icon.
export type UiIconButton = UiButton & { setIcon(url: string): void };
// A text button; `text` is its label, for buttons whose label changes.
export type UiTextButton = UiButton & { text: Text };

// A button's look: raised, lighter under the pointer, the accent colour
// while pressed, when it also sinks a little towards the panel.
function buttonLook(size: number, round: boolean, idle: ButtonColours): ContainerProperties {
    return {
        borderRadius: (round ? size / 2 : RADIUS.button) * MM,
        margin: space(1) * MM,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: idle.background,
        color: idle.text,
        transformTranslateZ: 0.035 * MM,
        hover: { backgroundColor: idle.hover },
        active: {
            backgroundColor: colour("accent"),
            color: colour("onAccent"),
            transformTranslateZ: 0.02 * MM,
        },
    };
}

// What a button does: `onSelect` when pressed, `onRelease` when the press
// ends, wherever the pointer is then, as a drag handle needs. A button keeps
// its clicks: the panel holding it doesn't get them.
function buttonHandlers(onSelect?: () => void, onRelease?: () => void): ContainerProperties {
    return {
        onClick: (event) => {
            asPointerEvent(event).stopPropagation();
            onSelect?.();
        },
        ...(onRelease ? { onPointerUp: () => onRelease() } : {}),
    };
}

// A button showing an icon, `size` metres high and, unless `width` says
// otherwise, as wide.
export function uiIconButton({
    icon,
    tooltip,
    onSelect,
    onRelease,
    size = BUTTON_SIZE,
    width = size,
    round = false,
    hovered,
}: {
    icon: string;
    tooltip?: string;
    onSelect?: () => void;
    onRelease?: () => void;
    size?: number;
    width?: number;
    round?: boolean;
    hovered?: ColourName;
}): UiIconButton {
    const image = new UiImage({ src: icon, width: size * 0.7 * MM, height: size * 0.7 * MM, pointerEvents: "none" });
    const idle = idleColours(hovered);
    const button = new Container({
        width: width * MM,
        height: size * MM,
        flexShrink: 0,
        ...buttonHandlers(onSelect, onRelease),
        ...buttonLook(size, round, idle),
    }) as UiIconButton;
    button.add(image);
    button.tooltip = tooltip;
    button.idle = idle;
    button.setIcon = (url: string) => image.setProperties({ src: url });
    return button;
}

// A text button; a label too long for the button is cut by its edges.
export function uiTextButton({
    label,
    tooltip,
    onSelect,
    width = 0.55,
    height = BUTTON_SIZE,
    fontSize = 0.07,
}: {
    label: string;
    tooltip?: string;
    onSelect?: () => void;
    width?: number;
    height?: number;
    fontSize?: number;
}): UiTextButton {
    const text = new Text({ text: label, fontSize: fontSize * MM, pointerEvents: "none" });
    const idle = idleColours();
    const button = new Container({
        width: width * MM,
        height: height * MM,
        flexShrink: 0,
        overflow: "hidden",
        ...buttonHandlers(onSelect),
        ...buttonLook(height, false, idle),
    }) as UiTextButton;
    button.add(text);
    button.tooltip = tooltip;
    button.idle = idle;
    button.text = text;
    return button;
}

// Text with no background, `color` a theme colour's name. Without a width,
// it takes the room left in its row (`grow`) or only what its text needs.
export function uiLabel(
    content: string,
    {
        width,
        grow = false,
        fontSize = 0.06,
        align = "left",
        color = "text",
    }: {
        width?: number;
        grow?: boolean;
        fontSize?: number;
        align?: "left" | "center" | "right";
        color?: ColourName;
    },
): Text {
    return new Text({
        text: content,
        fontSize: fontSize * MM,
        textAlign: align,
        color: colour(color),
        flexShrink: 0,
        ...(width !== undefined ? { width: width * MM } : grow ? { flexGrow: 1 } : {}),
    });
}

// A row of components, centred across it, `height` metres high.
export function uiRow(children: Component[], { height = BUTTON_SIZE + 0.04 }: { height?: number } = {}): Container {
    const row = new Container({ flexDirection: "row", alignItems: "center", height: height * MM, flexShrink: 0 });
    for (const child of children) row.add(child);
    return row;
}

// A thin line across a panel, between sections that aren't the same kind of
// thing, such as settings and information.
export function uiDivider(): Container {
    const space3 = space(3) * MM;
    const holder = new Container({ height: space3, flexShrink: 0, justifyContent: "center" });
    holder.add(new Container({ height: BORDER_WIDTH * MM, backgroundColor: colour("border") }));
    return holder;
}

// Shows a button as on, in the accent colour or "danger" (the mute button
// while muted), lighter under the pointer, until it is marked off again.
export function uiMarkActive(
    button: UiButton,
    active: boolean,
    { color = "accent" }: { color?: "accent" | "danger" } = {},
) {
    const idle = button.idle;
    idle.background.value = colour(active ? color : "raised");
    idle.text.value = colour(active && color === "accent" ? "onAccent" : "text");
    idle.hover.value = colour(active ? `${color}Hovered` : idle.restHover);
}

// `hovered` is the background under the pointer, such as "danger" for the
// power button.
function idleColours(hovered: ColourName = "hovered"): ButtonColours {
    return {
        background: signal(colour("raised")),
        text: signal(colour("text")),
        hover: signal(colour(hovered)),
        restHover: hovered,
    };
}
