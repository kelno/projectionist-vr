import { Container } from "@pmndrs/uikit";
import { computed, signal } from "@preact/signals-core";

import { KEYBOARD_PAGES, LAYOUTS, defaultLayout } from "./keyboardLayout.ts";
import type { Key, Layout, PageName } from "./keyboardLayout.ts";
import { space } from "./theme.ts";
import { loadPreference, savePreference } from "../browserPreferences.ts";
import { MM, UI_SURFACE, uiIconButton, uiTextButton, uikitPanel, DRAW_ORDER } from "./uikit.ts";
import type { UiButton } from "./uikit.ts";

import Backspace from "../../assets/icons/backspace.png";
import Enter from "../../assets/icons/enter.png";

// The app's own on-screen keyboard, for browsers that don't offer the
// headset's, such as Wolvic: a uikit panel showing one page of keys at a time
// (keyboardLayout.ts), the letters first. `onType` gets the character of each
// key pressed, a space for the space bar; the keys to another page or layout
// are handled here, and the layout chosen is kept in the browser.
const WIDTH = 4.4;
const HEIGHT = 1.6;
const KEY_HEIGHT = 0.32;
const FONT_SIZE = 0.12;
// The symbols page has more keys to a row than the letters pages.
const KEY_WIDTH: Record<PageName, number> = { qwerty: 0.36, azerty: 0.36, symbols: 0.27 };
const WIDE_KEY = 0.6;
const SPACE_BAR = 1.4;
const LAYOUT_PREFERENCE = "keyboardLayout";

function savedLayout(): Layout {
    const saved = loadPreference(LAYOUT_PREFERENCE);
    return LAYOUTS.find((layout) => layout === saved) ?? defaultLayout(navigator.languages ?? [navigator.language]);
}

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
    const layout = signal<Layout>(savedLayout());
    const current = signal<PageName>(layout.value);

    // A key of the page `page`.
    function makeKey(key: Key, page: PageName): UiButton {
        const text = { width: KEY_WIDTH[page], height: KEY_HEIGHT, fontSize: FONT_SIZE };
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
                return uiTextButton({
                    label: "abc",
                    ...text,
                    width: WIDE_KEY,
                    onSelect: () => (current.value = layout.value),
                });
            case "symbols":
                return uiTextButton({
                    label: "?123",
                    ...text,
                    width: WIDE_KEY,
                    onSelect: () => (current.value = "symbols"),
                });
            case "layout":
                // The key shows its page's layout; pressing it switches to
                // the other one.
                return uiTextButton({
                    label: page,
                    ...text,
                    width: WIDE_KEY,
                    onSelect: () => {
                        layout.value = layout.value === "qwerty" ? "azerty" : "qwerty";
                        savePreference(LAYOUT_PREFERENCE, layout.value);
                        current.value = layout.value;
                    },
                });
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
            for (const key of keys) row.add(makeKey(key, name));
            page.add(row);
        }
        root.add(page);
    }

    return {
        root,
        reset: () => {
            current.value = layout.value;
        },
    };
}
