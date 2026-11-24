// A webpack loader for @pmndrs/uikit's font cache (dist/text/cache.js): it
// turns off mipmaps on the font image, as three-mesh-ui does. uikit leaves
// them on, and MSDF text drawn a little smaller than the image, as in the
// headset, then samples a blurred distance field and looks soft. uikit has no
// setting for it. The build fails if uikit's code no longer has the line, so
// an update can't drop the fix unnoticed.
const LINE = "page.flipY = false;";

module.exports = function uikitFontFilterLoader(source) {
    if (!source.includes(LINE)) {
        throw new Error(
            `uikit-font-filter-loader: "${LINE}" not found in ${this.resourcePath}; check the font filter fix`,
        );
    }
    // 1006 is three.js's LinearFilter.
    return source.replace(LINE, `${LINE} page.generateMipmaps = false; page.minFilter = 1006;`);
};
