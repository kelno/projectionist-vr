import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { KEYBOARD_PAGES } from "../src/ui/keyboardLayout.ts";

const font = JSON.parse(readFileSync(new URL("../assets/fonts/Roboto-Regular-msdf.json", import.meta.url), "utf8")) as {
    info: { charset: string[] };
};
const charset = new Set(font.info.charset);

const typed = Object.values(KEYBOARD_PAGES)
    .flat(2)
    .filter((key): key is string => typeof key === "string");

test("every key types a character the font has", () => {
    for (const character of typed) {
        assert.ok(charset.has(character), `the font has no ${JSON.stringify(character)}`);
    }
});

test("every character of the font but the capitals has a key", () => {
    const keys = new Set(typed);
    const missing = [...charset].filter((character) => !/[A-Z]/.test(character) && !keys.has(character));
    assert.deepEqual(missing, []);
});

test("no character has two keys on the same page", () => {
    for (const [name, rows] of Object.entries(KEYBOARD_PAGES)) {
        const characters = rows.flat().filter((key) => typeof key === "string");
        assert.equal(new Set(characters).size, characters.length, name);
    }
});
