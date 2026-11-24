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
