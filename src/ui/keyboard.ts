import { Container } from "@pmndrs/uikit";
import { computed, signal } from "@preact/signals-core";

import { KEYBOARD_PAGES } from "./keyboardLayout.ts";
import type { Key, PageName } from "./keyboardLayout.ts";
import { space } from "./theme.ts";
import { MM, UI_SURFACE, uiIconButton, uiTextButton, uikitPanel, DRAW_ORDER } from "./uikit.ts";
import type { UiButton } from "./uikit.ts";

import Backspace from "../../assets/icons/backspace.png";
import Enter from "../../assets/icons/enter.png";

// The app's own on-screen keyboard, for browsers that don't offer the
// headset's: a uikit panel showing one page of keys at a time
// (keyboardLayout.ts), the letters first. `onType` gets the character of each
// key pressed, a space for the space bar; the key to the other page is
// handled here.
const WIDTH = 4.4;
const HEIGHT = 1.6;
const KEY_HEIGHT = 0.32;
const FONT_SIZE = 0.12;
// The symbols page has more keys to a row than the letters page.
const KEY_WIDTH: Record<PageName, number> = { letters: 0.36, symbols: 0.27 };
const WIDE_KEY = 0.6;
const SPACE_BAR = 1.8;

export interface OnScreenKeyboard {
    root: Container;
    // Shows the letters page, as when the keyboard opens.
    reset(): void;
}

export function createKeyboard({
    onType,
    onBackspace,
    onEnter,
}: {
    onType: (character: string) => void;
    onBackspace: () => void;
    onEnter: () => void;
}): OnScreenKeyboard {
    // The page showing, as a signal: uikit follows its changes by itself,
    // whereas setProperties() during a press leaves the key pressed.
    const current = signal<PageName>("letters");

    function makeKey(key: Key, width: number): UiButton {
        const text = { width, height: KEY_HEIGHT, fontSize: FONT_SIZE };
        if (typeof key === "string") {
            return uiTextButton({ label: key, ...text, onSelect: () => onType(key) });
        }
        switch (key.command) {
            case "backspace":
                return uiIconButton({ icon: Backspace, size: KEY_HEIGHT, width: WIDE_KEY, onSelect: onBackspace });
            case "enter":
                return uiIconButton({ icon: Enter, size: KEY_HEIGHT, width: WIDE_KEY, onSelect: onEnter });
            case "space":
                return uiTextButton({ label: "", ...text, width: SPACE_BAR, onSelect: () => onType(" ") });
            case "letters":
            case "symbols": {
                const page = key.command;
                const label = page === "letters" ? "abc" : "?123";
                return uiTextButton({ label, ...text, width: WIDE_KEY, onSelect: () => (current.value = page) });
            }
        }
    }

    const root = uikitPanel(WIDTH, HEIGHT, {
        renderOrder: DRAW_ORDER.window,
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        padding: space(2) * MM,
        ...UI_SURFACE,
    });
    for (const [name, rows] of Object.entries(KEYBOARD_PAGES) as [PageName, Key[][]][]) {
        const page = new Container({
            flexDirection: "column",
            alignItems: "center",
            flexShrink: 0,
            display: computed(() => (current.value === name ? "flex" : "none")),
        });
        for (const keys of rows) {
            const row = new Container({ flexDirection: "row", justifyContent: "center", flexShrink: 0 });
            for (const key of keys) row.add(makeKey(key, KEY_WIDTH[name]));
            page.add(row);
        }
        root.add(page);
    }

    return {
        root,
        reset: () => {
            current.value = "letters";
        },
    };
}
