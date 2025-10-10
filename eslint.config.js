import js from "@eslint/js";
import globals from "globals";
import prettier from "eslint-plugin-prettier";
import importPlugin from "eslint-plugin-import";

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
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "no-console": "warn",
      "quotes": ["error", "single"],
      "semi": ["error", "always"],
      "indent": ["error", 2],
      "import/order": [
        "warn",
        {
          groups: [
            ["builtin", "external"],
            ["internal"],
            ["parent", "sibling", "index"]
          ],
          "newlines-between": "always"
        }
      ],
      "prettier/prettier": [
        "error",
        {
          singleQuote: true,
          semi: true,
          tabWidth: 2,
          trailingComma: "es5",
          endOfLine: "auto"
        }
      ]
    }
  },
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "coverage/**",
      "**/*.min.js",
      "**/*.bundle.js",
      ".git/**",
      ".vscode/**"
    ]
  }
];