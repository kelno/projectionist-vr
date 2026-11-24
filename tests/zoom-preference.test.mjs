import assert from "node:assert/strict";
import test from "node:test";

import { loadPreference, savePreference } from "../src/browserPreferences.mjs";

function installStorage() {
    const values = new Map();
    const originalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
    Object.defineProperty(globalThis, "localStorage", {
        configurable: true,
        value: {
            getItem(key) {
                return values.get(key) ?? null;
            },
            setItem(key, value) {
                values.set(key, value);
            },
        },
    });
    return () => {
        if (originalStorage) {
            Object.defineProperty(globalThis, "localStorage", originalStorage);
        } else {
            delete globalThis.localStorage;
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
