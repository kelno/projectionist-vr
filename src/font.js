import FontJSON from "../assets/fonts/Roboto-Regular-msdf.json";

const supportedCharacters = new Set(FontJSON.info.charset);

/**
 * ThreeMeshUI does not gracefully handle a character missing from its MSDF
 * font: it logs a warning, then throws while looking up that glyph. Library
 * labels come from user-controlled filenames, so replace only unsupported
 * display characters and leave the original file paths untouched.
 */
export function sanitizeFontText(value) {
    return Array.from(String(value)).map((character) => {
        return supportedCharacters.has(character) || /\s/.test(character)
            ? character
            : "?";
    }).join("");
}

// The text, safe for the font, cut with "..." past `length` characters, for
// a label that must stay on one line.
export function shortenText(value, length) {
    const text = sanitizeFontText(value);
    return text.length > length ? `${text.slice(0, length - 3).trimEnd()}...` : text;
}
