const PREFERENCES_STORAGE_KEY = "web-vr-video-player.preferences";

// The saved preferences, by name; each value is whatever JSON gave back.
function readPreferences(): Record<string, unknown> {
    try {
        const serializedPreferences = globalThis.localStorage?.getItem(PREFERENCES_STORAGE_KEY);
        if (serializedPreferences === null) {
            return {};
        }
        const preferences: unknown = JSON.parse(serializedPreferences);
        return preferences !== null && typeof preferences === "object" && !Array.isArray(preferences)
            ? (preferences as Record<string, unknown>)
            : {};
    } catch {
        // Storage can be unavailable in private browsing or blocked by policy.
        return {};
    }
}

export function loadPreference(name: string): unknown {
    const preferences = readPreferences();
    return Object.hasOwn(preferences, name) ? preferences[name] : null;
}

export function savePreference(name: string, value: unknown): void {
    try {
        const preferences = readPreferences();
        preferences[name] = value;
        globalThis.localStorage?.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
    } catch {
        // A failed save must not prevent the feature itself from working.
    }
}
