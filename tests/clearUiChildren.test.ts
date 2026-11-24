import assert from "node:assert/strict";
import test from "node:test";

import clearUiChildren from "../src/ui/clearUiChildren.ts";

function createChild(name: string, cleared: string[]) {
    return {
        name,
        clear() {
            cleared.push(name);
        },
    };
}

test("clears and removes every direct UI child", () => {
    const cleared: string[] = [];
    const first = createChild("first", cleared);
    const second = createChild("second", cleared);
    const container = {
        children: [first, second],
        remove(child: { name: string; clear(): void }) {
            this.children.splice(this.children.indexOf(child), 1);
        },
    };

    clearUiChildren(container);

    assert.deepEqual(cleared, ["first", "second"]);
    assert.deepEqual(container.children, []);
});
