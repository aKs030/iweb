// eslint.config.js
import js from "@eslint/js";
import globals from "globals";
import prettier from "eslint-plugin-prettier";
import importPlugin from "eslint-plugin-import";

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "module",
      globals: {
        ...globals.browser, // Alle Standard-Browser-Globals automatisch
        ...globals.node,    // Falls du auch Node-Skripte hast
        // Portfolio-spezifische Globals
        THREE: "readonly",                 // Three.js für das Earth System
        announce: "readonly",              // window.announce für Accessibility
        enhancedAnimationEngine: "readonly" // Eigene Animation Engine API
      }
    },
    plugins: {
      prettier,
      import: importPlugin
    },
    rules: {
      // Ungenutzte Variablen: alles mit "_" wird ignoriert
      "no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_"
        }
      ],

      // Moderne JavaScript Best Practices
      "prefer-const": "error",
      "no-var": "error",
      "prefer-template": "warn",
      "prefer-arrow-callback": "warn",

      // Code Style
      "no-console": ["warn", { allow: ["warn", "error"] }],
      indent: ["error", 2],
      quotes: ["error", "single"],
      semi: ["error", "always"],
      "no-multiple-empty-lines": ["error", { max: 2 }],
      "comma-dangle": ["error", "never"],

      // Performance & Qualität
      "no-duplicate-imports": "error",
      "no-useless-concat": "error",
      "prefer-destructuring": ["warn", { object: true, array: false }],

      // Import-Ordnungscheck
      "import/order": [
        "warn",
        {
          groups: ["builtin", "external", "internal", "parent", "sibling", "index"],
          "newlines-between": "always",
          pathGroups: [
            {
              pattern: "./utils/**",
              group: "internal",
              position: "before"
            },
            {
              pattern: "./utils",
              group: "internal",
              position: "before"
            }
          ],
          pathGroupsExcludedImportTypes: ["builtin"],
          alphabetize: { order: "asc", caseInsensitive: true }
        }
      ],

      // Prettier-Check (optional, falls du Prettier nutzt)
      "prettier/prettier": [
        "error",
        {
          singleQuote: true,
          semi: true,
          endOfLine: "auto",
          trailingComma: "none"
        }
      ]
    },
    files: ["content/**/*.js", "pages/**/*.js", "scripts/**/*.js"]
  },
  {
    ignores: [
      "node_modules/**",
      ".git/**",
      "**/three.module.js",  // Three.js Library
      "**/*.min.js",         // Minifizierte Dateien
      "coverage/**",         // Test Coverage
      ".vscode/**",          // VS Code Settings
      "dist/**",             // Build Output
      "**/*.bundle.js"       // Bundle Files
    ]
  }
];