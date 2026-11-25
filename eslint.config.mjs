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
        // node:test's test() returns a promise the runner itself awaits.
        files: ["tests/**"],
        rules: {
            "@typescript-eslint/no-floating-promises": [
                "error",
                {
                    allowForKnownSafeCalls: [
                        { from: "package", name: ["test", "describe", "it"], package: "node:test" },
                    ],
                },
            ],
        },
    },
    {
        // Node runs the tests, the icon script and the build configuration.
        files: ["tests/**", "scripts/**", "*.cjs", "*.mjs", "build/*.cjs"],
        languageOptions: { globals: { ...globals.node } },
    },
    {
        // The build configuration, its loaders and this file are plain JavaScript.
        files: ["*.cjs", "*.mjs", "build/*.cjs"],
        ...tseslint.configs.disableTypeChecked,
    },
    {
        files: ["webpack.config.cjs"],
        languageOptions: { sourceType: "commonjs" },
        rules: { "@typescript-eslint/no-require-imports": "off" },
    },
    prettier,
);
