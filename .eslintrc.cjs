module.exports = {
  root: true,
  ignorePatterns: ['node_modules/', 'dist/', 'build/', 'coverage/', '.nyc_output/', 'content/config/videos-part-*.js'],
  env: { es2022: true, node: true, browser: true },
  extends: ['eslint:recommended', 'plugin:prettier/recommended', 'plugin:import/recommended'],
  plugins: ['prettier', 'import'],
  parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
  globals: { gtag: 'readonly' },
  rules: {
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
    'no-empty': ['error', { allowEmptyCatch: true }],
    'no-undef': ['error', { typeof: true }],
  },
  overrides: [
    {
      files: ['scripts/**', '*.config.js'],
      env: { node: true, browser: false },
      rules: { 'no-console': 'off' },
    },
    {
      files: ['pages/**', 'content/**'],
      rules: { 'import/no-unresolved': 'off' },
    },
  ],
};
