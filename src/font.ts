import FontJSON from "../assets/fonts/Roboto-Regular-msdf.json";

const supportedCharacters = new Set(FontJSON.info.charset);

// The text with each character the player's font lacks replaced by "?",
// which uikit would otherwise draw as nothing. Library labels come from file
// names, so only what's shown changes, never the paths.
export function sanitizeFontText(value: unknown): string {
    return Array.from(String(value))
        .map((character) => {
            return supportedCharacters.has(character) || /\s/.test(character) ? character : "?";
        })
        .join("");
}

// The text, safe for the font, cut with "..." past `length` characters, for
// a label that must stay on one line.
export function shortenText(value: unknown, length: number): string {
    const text = sanitizeFontText(value);
    return text.length > length ? `${text.slice(0, length - 3).trimEnd()}...` : text;
}
