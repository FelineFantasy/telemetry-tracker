import path from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";
import tseslint from "typescript-eslint";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const nextConfigs = compat.extends("next/core-web-vitals", "next/typescript");

const dashboardRoot = path.join(__dirname, "apps/dashboard");

const apiTsFiles = "**/apps/api/**/*.ts";
const packageTsFiles = "**/packages/**/src/**/*.{ts,tsx}";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "**/coverage/**",
      "pnpm-lock.yaml",
      "**/next-env.d.ts",
      "**/packages/**/*.test.ts",
    ],
  },
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: [apiTsFiles],
    languageOptions: {
      ...config.languageOptions,
      parserOptions: {
        ...config.languageOptions?.parserOptions,
        project: "./tsconfig.eslint.json",
        tsconfigRootDir: path.join(__dirname, "apps/api"),
      },
    },
    rules: {
      ...config.rules,
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  })),
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: [packageTsFiles],
    languageOptions: {
      ...config.languageOptions,
      parserOptions: {
        ...config.languageOptions?.parserOptions,
        projectService: true,
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      ...config.rules,
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  })),
  ...nextConfigs.map((config) => ({
    ...config,
    files: ["**/apps/dashboard/**/*.{js,jsx,ts,tsx,mjs}"],
    settings: {
      ...config.settings,
      next: {
        rootDir: dashboardRoot,
      },
    },
    rules: {
      ...config.rules,
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  })),
);
