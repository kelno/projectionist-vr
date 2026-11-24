import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
// webpack.config.cjs is plain CommonJS: these are the parts the tests use.
interface PlayerSettings {
    library?: { videos_path?: string };
    web?: { site_url_prefix?: string };
    player?: { default_sbs_zoom?: number };
}
interface WebpackConfigModule {
    (env: Record<string, boolean>): { output: { publicPath: string } }[];
    parseToml: (text: string) => PlayerSettings;
    playerConfig: (config: PlayerSettings) => { defaultSbsZoom: number };
}
const webpackConfig = require("../webpack.config.cjs") as WebpackConfigModule;
const { parseToml, playerConfig } = webpackConfig;

test("keeps local library paths separate from web and player settings", () => {
    const config = parseToml(`
[library]
videos_path = "/library"

[web]
site_url_prefix = "/vr-player"

[player]
default_sbs_zoom = 75.5
`);

    assert.equal(config.library?.videos_path, "/library");
    assert.equal(config.web?.site_url_prefix, "/vr-player");
    assert.deepEqual(playerConfig(config), { defaultSbsZoom: 75.5 });
});

test("uses the established SBS zoom when the setting is absent or invalid", () => {
    assert.deepEqual(playerConfig({}), { defaultSbsZoom: 100 });
    assert.deepEqual(playerConfig({ player: { default_sbs_zoom: 181 } }), { defaultSbsZoom: 100 });
});

test("builds production releases that work at any site path", () => {
    const [config] = webpackConfig({ production: true });

    assert.equal(config.output.publicPath, "auto");
});
