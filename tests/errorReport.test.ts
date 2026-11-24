import assert from "node:assert/strict";
import test from "node:test";

import { createErrorReporter } from "../src/errorReport.ts";

function reporter(max) {
    const queries = [];
    const report = createErrorReporter({
        send: (query) => queries.push(new URLSearchParams(query)),
        version: "1.7.0",
        max,
    });
    return { report, queries };
}

test("sends the version, where, message and the top of the stack", () => {
    const { report, queries } = reporter();
    const error = new TypeError("x is undefined");
    error.stack = "TypeError: x is undefined\n  at a (index.js:1)\n  at b (index.js:2)\n  at c (index.js:3)\n  at d (index.js:4)";
    report("frame", error);
    assert.equal(queries.length, 1);
    assert.equal(queries[0].get("v"), "1.7.0");
    assert.equal(queries[0].get("where"), "frame");
    assert.equal(queries[0].get("message"), "x is undefined");
    assert.equal(queries[0].get("stack"), "at a (index.js:1) | at b (index.js:2) | at c (index.js:3)");
});

test("sends a repeating error once", () => {
    const { report, queries } = reporter();
    assert.equal(report("frame", new Error("same")), true);
    assert.equal(report("frame", new Error("same")), false);
    assert.equal(report("promise", new Error("same")), true);
    assert.equal(queries.length, 2);
});

test("stops after the maximum", () => {
    const { report, queries } = reporter(2);
    report("frame", new Error("1"));
    report("frame", new Error("2"));
    report("frame", new Error("3"));
    assert.equal(queries.length, 2);
});

test("accepts things thrown that aren't errors", () => {
    const { report, queries } = reporter();
    report("promise", "plain text");
    assert.equal(queries[0].get("message"), "plain text");
    assert.equal(queries[0].get("stack"), "");
});
