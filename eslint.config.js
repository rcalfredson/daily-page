// eslint.config.js
import js from "@eslint/js";
import importPlugin from "eslint-plugin-import";
import n from "eslint-plugin-n";
import promise from "eslint-plugin-promise";

export default [
  js.configs.recommended,
  {
    files: ["**/*.{js,mjs,cjs}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
    },
    plugins: {
      import: importPlugin,
      n,
      promise,
    },
    rules: {
      // Tu regla personalizada de .eslintrc.json
      "import/extensions": [
        "error",
        "ignorePackages",
        { ".js": "never" },
      ],
    },
  },
];
