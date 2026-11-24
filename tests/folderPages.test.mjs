import assert from "node:assert/strict";
import test from "node:test";

import { folderPage } from "../src/FileBrowser/folderPages.mjs";

const describe = ({ rows }) =>
    rows.map((row) => (row.type === "folder" ? row.index : row.type));

test("all folders on one page when they fit", () => {
    assert.deepEqual(describe(folderPage(7, 0, 12)), [0, 1, 2, 3, 4, 5, 6]);
    assert.equal(folderPage(12, 0, 12).pageCount, 1);
});

test("more folders: pages of ten between previous and next", () => {
    assert.deepEqual(describe(folderPage(25, 0, 12)), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, "next"]);
    assert.deepEqual(describe(folderPage(25, 1, 12)), [
        "previous", 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, "next",
    ]);
    assert.deepEqual(describe(folderPage(25, 2, 12)), ["previous", 20, 21, 22, 23, 24]);
    assert.equal(folderPage(25, 0, 12).pageCount, 3);
});

test("every folder shows on exactly one page", () => {
    const seen = [];
    const { pageCount } = folderPage(40, 0, 12);
    for (let page = 0; page < pageCount; page++) {
        for (const row of folderPage(40, page, 12).rows) {
            if (row.type === "folder") {
                seen.push(row.index);
            }
        }
    }
    assert.deepEqual(seen, Array.from({ length: 40 }, (_, i) => i));
});

test("a page out of range shows the nearest one", () => {
    assert.deepEqual(describe(folderPage(25, 9, 12)), ["previous", 20, 21, 22, 23, 24]);
    assert.deepEqual(describe(folderPage(25, -1, 12))[0], 0);
});
