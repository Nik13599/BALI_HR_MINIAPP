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
      "!site/admin-platform-ui.js",
      "!site/production-client.js",
      "!site/production-loader.js",
      "!site/production-booking-qr.js",
      "!site/production-profile-economy.js",
      "!site/production-social-ui.js",
      "!site/preview-deeplink-beta4.js",
      "!site/production-integrated-home-beta4.js",
      "!site/admin-integrated-overview-beta4.js",
      "!site/beta4-app.js",
      "!site/beta4-social-page.js",
      "!site/bali-clans-demo-core-beta4.js",
      "!site/bali-people-clans-beta4.js",
      "!site/admin-clans-beta4.js",
      "!site/fast-event-dialog-beta4.js",
      "!site/nav-icons-core-beta4.js",
      "!site/legacy-nav-final-beta4.js",
      "!site/bali-visual-blocks-core-beta4.js",
      "!site/match3-game-ui-beta4.js"
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
      "site/admin-platform-ui.js",
      "site/production-client.js",
      "site/production-loader.js",
      "site/production-booking-qr.js",
      "site/production-profile-economy.js",
      "site/production-social-ui.js",
      "site/preview-deeplink-beta4.js",
      "site/production-integrated-home-beta4.js",
      "site/admin-integrated-overview-beta4.js",
      "site/beta4-app.js",
      "site/beta4-social-page.js",
      "site/bali-clans-demo-core-beta4.js",
      "site/bali-people-clans-beta4.js",
      "site/admin-clans-beta4.js",
      "site/fast-event-dialog-beta4.js",
      "site/nav-icons-core-beta4.js",
      "site/legacy-nav-final-beta4.js",
      "site/bali-visual-blocks-core-beta4.js",
      "site/match3-game-ui-beta4.js"
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
