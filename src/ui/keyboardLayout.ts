// The keys of the app's own on-screen keyboard, page by page and row by row.
// A key is the character it types, or a command. Only the player's font's
// characters can be typed: a key for any other would type a "?". The search
// ignores case, so the letters are lowercase, with no shift key.

export type KeyCommand = "backspace" | "enter" | "space" | "letters" | "symbols";
export type Key = string | { command: KeyCommand };
export type PageName = "letters" | "symbols";

const backspace: Key = { command: "backspace" };

// The bottom row: the key to the other page, then the comma, space, period
// and Enter.
function bottomRow(otherPage: PageName): Key[] {
    return [{ command: otherPage }, ",", { command: "space" }, ".", { command: "enter" }];
}

export const KEYBOARD_PAGES: Record<PageName, Key[][]> = {
    letters: [[..."qwertyuiop"], [..."asdfghjkl"], [..."zxcvbnm", backspace], bottomRow("symbols")],
    symbols: [[..."1234567890-_="], [..."@#$%&*+()[]{}"], [..."!\"':;/?^\\|`~", backspace], bottomRow("letters")],
};
