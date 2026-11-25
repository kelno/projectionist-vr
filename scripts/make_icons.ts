// Renders the player's icons from Material Symbols (Apache 2.0, weight 600 for legibility in VR, the
// @material-symbols/svg-600 dev dependency) to PNGs in assets/icons/.
// The icons are white, so a button's colour comes from the theme; the
// library's placeholder thumbnail is grey. Run after changing the list:
//     node scripts/make_icons.ts
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { Resvg } from "@resvg/resvg-js";

const require = createRequire(import.meta.url);
const SYMBOLS = join(dirname(require.resolve("@material-symbols/svg-600/package.json")), "rounded");
const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "assets", "icons");
const SIZE = 128;

// Output name: [symbol, colour].
const ICONS = {
    play: ["play_arrow-fill"],
    pause: ["pause-fill"],
    previous: ["skip_previous-fill"],
    next: ["skip_next-fill"],
    "back-10": ["replay_10-fill"],
    "forward-10": ["forward_10-fill"],
    volume: ["volume_up-fill"],
    mute: ["volume_off-fill"],
    settings: ["settings-fill"],
    library: ["video_library-fill"],
    reset: ["restart_alt-fill"],
    move: ["open_with-fill"],
    "zoom-in": ["zoom_in-fill"],
    "zoom-out": ["zoom_out-fill"],
    screen: ["tv-fill"],
    vr: ["vrpano-fill"],
    power: ["power_settings_new-fill"],
    sort: ["sort"],
    close: ["close"],
    left: ["chevron_left"],
    right: ["chevron_right"],
    up: ["keyboard_arrow_up"],
    down: ["keyboard_arrow_down"],
    backspace: ["backspace-fill"],
    enter: ["keyboard_return"],
    loop: ["repeat"],
    video: ["movie-fill", "#6b7280"],
};

mkdirSync(OUT, { recursive: true });
for (const [name, [symbol, colour = "#ffffff"]] of Object.entries(ICONS)) {
    const svg = readFileSync(join(SYMBOLS, `${symbol}.svg`), "utf8").replace("<svg ", `<svg fill="${colour}" `);
    const png = new Resvg(svg, { fitTo: { mode: "width", value: SIZE } }).render().asPng();
    writeFileSync(join(OUT, `${name}.png`), png);
}
console.log(`${Object.keys(ICONS).length} icons in ${OUT}`);
