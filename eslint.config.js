import eslint from "@eslint/js";
import astro from "eslint-plugin-astro";
import tseslint from "typescript-eslint";
import globals from "globals";

export default [
  {
    ignores: [
      "dist/**",
      ".astro/**",
      "coverage/**",
      "node_modules/**",
      ".gjc/**",
      "public/sandbox/**",
    ],
  },
  {
    files: ["*.config.{js,mjs,ts}", "eslint.config.js", "vitest.config.ts"],
    languageOptions: { globals: globals.node },
  },
  {
    files: ["src/**/*.{ts,tsx,astro}", "tests/**/*.{ts,tsx}", "sandbox-frame/**/*.{ts,js}"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.worker,
        ...globals.node,
      },
    },
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  ...astro.configs.recommended,
  {
    files: ["**/*.{ts,tsx,astro}"],
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-explicit-any": "error",
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
  {
    files: ["sandbox-frame/**/*.{js,ts}"],
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
      "no-unused-vars": "off",
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
];
