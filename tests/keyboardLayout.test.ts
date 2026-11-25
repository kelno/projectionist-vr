import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { KEYBOARD_PAGES, LAYOUTS, defaultLayout } from "../src/ui/keyboardLayout.ts";

const font = JSON.parse(readFileSync(new URL("../assets/fonts/Roboto-Regular-msdf.json", import.meta.url), "utf8")) as {
    info: { charset: string[] };
};
const charset = new Set(font.info.charset);

const charactersOf = (rows: (typeof KEYBOARD_PAGES)[keyof typeof KEYBOARD_PAGES]) =>
    rows.flat().filter((key): key is string => typeof key === "string");

test("every key types a character the font has", () => {
    for (const rows of Object.values(KEYBOARD_PAGES)) {
        for (const character of charactersOf(rows)) {
            assert.ok(charset.has(character), `the font has no ${JSON.stringify(character)}`);
        }
    }
});

test("each layout with the symbols has every character of the font but the capitals", () => {
    for (const layout of LAYOUTS) {
        const keys = new Set([...charactersOf(KEYBOARD_PAGES[layout]), ...charactersOf(KEYBOARD_PAGES.symbols)]);
        const missing = [...charset].filter((character) => !/[A-Z]/.test(character) && !keys.has(character));
        assert.deepEqual(missing, [], layout);
    }
});

test("no character has two keys on the same page", () => {
    for (const [name, rows] of Object.entries(KEYBOARD_PAGES)) {
        const characters = charactersOf(rows);
        assert.equal(new Set(characters).size, characters.length, name);
    }
});

test("AZERTY is the default only when French is among the browser's languages", () => {
    assert.equal(defaultLayout(["en-US", "fr-BE"]), "azerty");
    assert.equal(defaultLayout(["FR"]), "azerty");
    assert.equal(defaultLayout(["en-US"]), "qwerty");
    assert.equal(defaultLayout([]), "qwerty");
});
