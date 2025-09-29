import js from "@eslint/js";
import globals from "globals";

const baseConfig = js.configs.recommended;

const projectGlobals = {
  ...globals.browser,
  ...globals.node,
  THREE: "readonly",
  announce: "readonly",
  enhancedAnimationEngine: "readonly",
};

export default [
  {
    ...baseConfig,
    files: ["content/**/*.js", "pages/**/*.js", "scripts/**/*.js"],
    languageOptions: {
      ...(baseConfig.languageOptions ?? {}),
      ecmaVersion: 2024,
      sourceType: "module",
      globals: projectGlobals,
    },
  },
  {
    ignores: [
      "node_modules/**",
      ".git/**",
      "**/three.module.js",
      "**/*.min.js",
      "coverage/**",
      ".vscode/**",
      "dist/**",
      "**/*.bundle.js",
    ],
  },
];
