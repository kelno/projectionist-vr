// Images imported by the code: webpack's file-loader turns each into its URL.
declare module "*.png" {
    const url: string;
    export default url;
}

declare module "*.jpg" {
    const url: string;
    export default url;
}

// Values the build defines (webpack.config.js, DefinePlugin).
declare const __PLAYER_CONFIG__: { defaultSbsZoom: number };
declare const __PLAYER_VERSION__: string;
