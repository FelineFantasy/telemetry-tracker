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

const tsAppFiles = [
  "**/apps/api/**/*.ts",
  "**/packages/**/src/**/*.{ts,tsx}",
];

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "**/coverage/**",
      "pnpm-lock.yaml",
      "**/next-env.d.ts",
      // Vitest config and tests are not part of the API tsconfig project (build uses tsconfig.build.json).
      "apps/api/vitest.config.ts",
      "apps/api/**/*.test.ts",
    ],
  },
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: tsAppFiles,
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
