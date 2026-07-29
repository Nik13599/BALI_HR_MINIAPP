import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default [
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "site/*.js",
      "!site/telegram-app.js",
      "!site/clan-chat-app.js",
      "!site/admin-production.js",
      "!site/clan-chat-beta-store.js",
      "!site/clan-chat-beta-boot.js",
      "!site/admin-clan-chat-beta-boot.js"
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["server/**/*.ts", "tests/server/**/*.ts", "scripts/**/*.ts"],
    languageOptions: {
      parserOptions: { project: "./tsconfig.eslint.json" },
      globals: globals.node
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }]
    }
  },
  {
    files: [
      "site/telegram-app.js",
      "site/clan-chat-app.js",
      "site/admin-production.js",
      "site/clan-chat-beta-store.js",
      "site/clan-chat-beta-boot.js",
      "site/admin-clan-chat-beta-boot.js"
    ],
    languageOptions: { ecmaVersion: 2022, globals: globals.browser },
    rules: {
      "no-unused-vars": ["error", { "argsIgnorePattern": "^_" }]
    }
  },
  {
    files: ["scripts/**/*.mjs"],
    languageOptions: { ecmaVersion: 2022, globals: globals.node },
    rules: {
      "no-unused-vars": ["error", { "argsIgnorePattern": "^_" }]
    }
  }
];
