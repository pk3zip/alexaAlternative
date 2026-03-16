import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import json from "@eslint/json";

export default [
  {
    ignores: ["dist/**", "vendor/**", "package-lock.json", "alaxaAlteritive-e2ed4b8.tar.gz"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{js,mjs,cjs,ts,mts,cts}"],
    languageOptions: { 
      globals: globals.node,
      parserOptions: {
        project: "./tsconfig.json",
      }
    },
  },
  {
    files: ["**/*.json"],
    plugins: { json },
    language: "json/json",
    rules: {
      "json/no-empty-keys": "error"
    }
  },
];
