import assert from "node:assert/strict";
import test from "node:test";

import { loadPreference, savePreference } from "../src/browserPreferences.ts";

function installStorage() {
    const values = new Map<string, string>();
    const originalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
    Object.defineProperty(globalThis, "localStorage", {
        configurable: true,
        value: {
            getItem(key: string) {
                return values.get(key) ?? null;
            },
            setItem(key: string, value: string) {
                values.set(key, value);
            },
        },
    });
    return () => {
        if (originalStorage) {
            Object.defineProperty(globalThis, "localStorage", originalStorage);
        } else {
            // Only the fake was there: take it away again.
            delete (globalThis as { localStorage?: Storage }).localStorage;
        }
    };
}

test("saves and reloads a named preference", () => {
    const restoreStorage = installStorage();
    try {
        savePreference("zoom", 75.5);
        savePreference("volume", 0.5);
        assert.equal(loadPreference("zoom"), 75.5);
        assert.equal(loadPreference("volume"), 0.5);
    } finally {
        restoreStorage();
    }
});

test("an unsaved preference is null", () => {
    const restoreStorage = installStorage();
    try {
        assert.equal(loadPreference("zoom"), null);
    } finally {
        restoreStorage();
    }
});
