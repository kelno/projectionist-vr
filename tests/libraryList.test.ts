import assert from "node:assert/strict";
import test from "node:test";

import { filterFiles, listFiles, sortFiles } from "../src/FileBrowser/libraryList.ts";

const files = [
    { name: "Part 10", epoch: "300.5" },
    { name: "beach", epoch: "100" },
    { name: "Part 2", epoch: "200" },
];
const names = (list: { name: string }[]) => list.map((file) => file.name);

test("sorts names as people read them", () => {
    assert.deepEqual(names(sortFiles(files, "name-asc")), ["beach", "Part 2", "Part 10"]);
    assert.deepEqual(names(sortFiles(files, "name-desc")), ["Part 10", "Part 2", "beach"]);
});

test("sorts by date, newest or oldest first", () => {
    assert.deepEqual(names(sortFiles(files, "date-desc")), ["Part 10", "Part 2", "beach"]);
    assert.deepEqual(names(sortFiles(files, "date-asc")), ["beach", "Part 2", "Part 10"]);
});

test("an unknown sort falls back to name order", () => {
    assert.deepEqual(names(sortFiles(files, "size")), ["beach", "Part 2", "Part 10"]);
});

test("filters by name, ignoring case and surrounding spaces", () => {
    assert.deepEqual(names(filterFiles(files, " PART ")), ["Part 10", "Part 2"]);
    assert.deepEqual(names(filterFiles(files, "")), names(files));
    assert.deepEqual(filterFiles(files, "nothing"), []);
});

test("leaves the catalogue's list untouched", () => {
    const before = names(files);
    listFiles(files, { phrase: "part", sort: "date-desc" });
    assert.deepEqual(names(files), before);
});
