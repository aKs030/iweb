module.exports = {
  root: true,
  env: {
    es2022: true,
    node: true,
    browser: true,
  },
  extends: ["eslint:recommended", "plugin:prettier/recommended", "plugin:import/recommended"],
  plugins: ["prettier", "import"],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
  },
  rules: {
    // project-specific overrides
    "no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
    "no-console": ["warn", { allow: ["warn", "error", "info"] }],
    // allow empty catch blocks commonly used when ignoring errors intentionally
    "no-empty": ["error", { "allowEmptyCatch": true }],
    // runtime globals used by analytics
    "no-undef": ["error", { "typeof": true }],
  },
  globals: {
    gtag: 'readonly'
  },
  overrides: [
    {
      files: ["scripts/**", "*.config.js"],
      env: { node: true, browser: false },
      rules: { "no-console": "off" }
    },
    {
      files: ["pages/**", "content/**"],
      rules: {
        // These imports are resolved at runtime (CDN or server-side injection)
        "import/no-unresolved": "off"
      }
    }
  ]
};
