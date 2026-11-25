// The keys of the app's own on-screen keyboard, page by page and row by row:
// the letters in QWERTY or AZERTY, and the symbols. A key is the character it
// types, or a command. Only the player's font's characters can be typed: a key
// for any other would type a "?". The search ignores case, so the letters are
// lowercase, with no shift key.

export type Layout = "qwerty" | "azerty";
export type PageName = Layout | "symbols";
// "letters" goes back to the letters in the layout in use; "layout" switches
// to the other layout.
export type KeyCommand = "backspace" | "enter" | "space" | "letters" | "symbols" | "layout";
export type Key = string | { command: KeyCommand };

export const LAYOUTS: Layout[] = ["qwerty", "azerty"];

const backspace: Key = { command: "backspace" };

function letters(top: string, middle: string, bottom: string): Key[][] {
    return [
        [...top],
        [...middle],
        [...bottom, backspace],
        [{ command: "symbols" }, { command: "layout" }, ",", { command: "space" }, ".", { command: "enter" }],
    ];
}

export const KEYBOARD_PAGES: Record<PageName, Key[][]> = {
    qwerty: letters("qwertyuiop", "asdfghjkl", "zxcvbnm"),
    azerty: letters("azertyuiop", "qsdfghjklm", "wxcvbn"),
    symbols: [
        [..."1234567890-_="],
        [..."@#$%&*+()[]{}"],
        [..."!\"':;/?^\\|`~", backspace],
        [{ command: "letters" }, ",", { command: "space" }, ".", { command: "enter" }],
    ],
};

// The layout to start with before one was chosen: AZERTY when French is among
// the browser's languages. Browsers don't say which keyboard layout is used,
// and a headset's browser is often in English whatever the user types, hence
// the layout key, whose choice is kept.
export function defaultLayout(languages: readonly string[]): Layout {
    return languages.some((language) => language.toLowerCase().startsWith("fr")) ? "azerty" : "qwerty";
}
