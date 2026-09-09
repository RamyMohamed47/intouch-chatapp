import js from "@eslint/js";
import prettierConfig from "eslint-config-prettier";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      ".agents/**",
      "dist/**",
      "apps/*/dist/**",
      "apps/*/.expo/**",
      "apps/*/.next/**",
      "apps/web/*.config.mjs",
      "apps/mobile/*.config.cjs",
      "apps/mobile/*.config.js",
      "apps/mobile/*.config.mjs",
      "apps/mobile/app.config.ts",
      "apps/mobile/expo-env.d.ts",
      "packages/*/dist/**",
      "node_modules/**",
      "coverage/**",
      "eslint.config.mjs",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      ecmaVersion: 2024,
      globals: {
        ...globals.node,
      },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ["apps/web/**/*.{ts,tsx}"],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },
  {
    files: ["apps/mobile/**/*.{ts,tsx}"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.jest,
      },
    },
  },
  {
    files: ["apps/web/public/**/*.js"],
    languageOptions: {
      globals: {
        ...globals.serviceworker,
      },
      parserOptions: {
        projectService: false,
      },
    },
    rules: {
      ...tseslint.configs.disableTypeChecked.rules,
    },
  },
  {
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      parserOptions: {
        projectService: false,
      },
    },
    rules: {
      ...tseslint.configs.disableTypeChecked.rules,
    },
  },
  {
    files: ["apps/api/tests/**/*.ts", "packages/*/tests/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-floating-promises": "off",
      "@typescript-eslint/require-await": "off",
    },
  },
  prettierConfig,
);
