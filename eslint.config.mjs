// ESLint: the recommended rules of ESLint and typescript-eslint, with type
// information, on the player's TypeScript; formatting is Prettier's job
// (eslint-config-prettier turns off the rules that would fight it).
import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
    { ignores: ["dist/", "node_modules/", "vendor/", ".venv/", "coverage/"] },
    js.configs.recommended,
    ...tseslint.configs.recommendedTypeChecked,
    {
        languageOptions: {
            parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
            globals: { ...globals.browser },
        },
    },
    {
        // three-mesh-ui's objects are typed loosely on purpose until it is
        // replaced (src/types/three-mesh-ui.d.ts), so the code drawing panels
        // works with untyped values; the rest of the code keeps these rules.
        files: ["src/ui/**", "src/PlayerPanelUI.ts", "src/FileBrowser/**", "src/index.ts", "src/UI.ts", "src/input/pointer.ts"],
        rules: {
            "@typescript-eslint/no-unsafe-call": "off",
            "@typescript-eslint/no-unsafe-member-access": "off",
            "@typescript-eslint/no-unsafe-assignment": "off",
            "@typescript-eslint/no-unsafe-return": "off",
            "@typescript-eslint/no-unsafe-argument": "off",
        },
    },
    {
        // node:test's test() returns a promise the runner itself awaits.
        files: ["tests/**"],
        rules: { "@typescript-eslint/no-floating-promises": ["error", { allowForKnownSafeCalls: [{ from: "package", name: ["test", "describe", "it"], package: "node:test" }] }] },
    },
    {
        // Node runs the tests, the icon script and the build configuration.
        files: ["tests/**", "scripts/**", "*.js", "*.mjs"],
        languageOptions: { globals: { ...globals.node } },
    },
    {
        // The build configuration and this file are plain JavaScript.
        files: ["*.js", "*.mjs"],
        ...tseslint.configs.disableTypeChecked,
    },
    {
        files: ["webpack.config.js"],
        languageOptions: { sourceType: "commonjs" },
        rules: { "@typescript-eslint/no-require-imports": "off" },
    },
    prettier,
);
