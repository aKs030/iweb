import js from "@eslint/js";
import importPlugin from "eslint-plugin-import";
import prettier from "eslint-plugin-prettier";
import globals from "globals";

export default [
  {
    ...js.configs.recommended,
    files: ["content/**/*.js", "pages/**/*.js", "scripts/**/*.js"],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
        THREE: "readonly",
        announce: "readonly",
      },
    },
    plugins: {
      prettier,
      import: importPlugin,
    },
    rules: {
      // Variable & Function Rules
      "no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrors: "all",
        },
      ],
      "no-undef": "error",
      "prefer-const": "warn",

      // Code Quality
      "no-console": ["warn", { allow: ["error", "warn"] }],
      "no-debugger": "error",
      "no-alert": "warn",
      eqeqeq: ["error", "always", { null: "ignore" }],
      curly: ["error", "multi-line"],

      // Style (Prettier übernimmt Formatierung)
      quotes: ["error", "double", { avoidEscape: true }],
      semi: ["error", "always"],

      // Import Rules (kritisch für ES6 Module)
      "import/no-unresolved": [
        "error",
        {
          ignore: ["^/content/", "^/pages/", "three"],
        },
      ],
      "import/extensions": [
        "error",
        "always",
        {
          ignorePackages: true,
        },
      ],
      "import/order": [
        "warn",
        {
          groups: [
            ["builtin", "external"],
            ["internal"],
            ["parent", "sibling", "index"],
          ],
          "newlines-between": "always",
          alphabetize: { order: "asc", caseInsensitive: true },
        },
      ],
      "import/no-duplicates": "error",

      // Prettier Integration
      "prettier/prettier": [
        "error",
        {
          singleQuote: false,
          semi: true,
          tabWidth: 2,
          trailingComma: "es5",
          endOfLine: "auto",
          printWidth: 80,
        },
      ],
    },
  },
  {
    files: ["scripts/**/*.js"],
    rules: {
      // CLI-Skripte benötigen ausführliche Konsolen-Ausgaben
      "no-console": "off",
    },
  },
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "coverage/**",
      "**/*.min.js",
      "**/*.bundle.js",
      ".git/**",
      ".vscode/**",
      ".idea/**",
      "reports/**",
      "content/webentwicklung/lib/**",
    ],
  },
];
