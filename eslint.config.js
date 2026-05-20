import js from "@eslint/js";
import globals from "globals";

export default [
  {
    ignores: [
      "node_modules/**",
      ".wrangler/**",
      ".cache/**",
      "*.cache",
      ".DS_Store",
      "dist/**",
      "build/**",
    ],
  },
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
        // Cloudflare Workers globals
        HTMLRewriter: "readonly",
        request: "readonly",
        response: "readonly",
        env: "readonly",
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      // Customizations
      "no-unused-vars": [
        "error",
        {
          vars: "all",
          args: "none",
          ignoreRestSiblings: true,
        },
      ],
      "no-console": [
        "warn",
        {
          allow: ["warn", "error"],
        },
      ],
      "no-constant-condition": "warn",
      "prefer-const": "error",
      "no-var": "error",
    },
  },
  {
    files: ["**/*.mjs", "**/*.cjs"],
    languageOptions: {
      sourceType: "module",
    },
  },
];
