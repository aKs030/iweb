module.exports = {
  root: true,
  env: {
    browser: true,
    node: true,
    es2022: true,
  },
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
  },

  ignorePatterns: ["content/vendor/**", "archive/**", "public/**"],
  extends: ["eslint:recommended"],
  plugins: ["unused-imports", "import"],
  rules: {
    // relax some rules to avoid noisy errors during cleanup
    "no-console": "off",
    "no-unused-vars": ["warn", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }],
    "no-empty": ["warn", { "allowEmptyCatch": true }],
    "prefer-const": "warn",

    // Unused imports / exports checks
    "unused-imports/no-unused-imports": "warn",
    "unused-imports/no-unused-vars": ["warn", { "vars": "all", "varsIgnorePattern": "^_", "args": "after-used", "argsIgnorePattern": "^_" }],
    "import/no-unused-modules": ["warn", { "unusedExports": true, "missingExports": false }]
  }

};
