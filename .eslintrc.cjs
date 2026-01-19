module.exports = {
  root: true,
  ignorePatterns: ['node_modules/', 'dist/', 'build/', 'coverage/', '.nyc_output/', 'content/config/videos-part-*.js', 'workers/throbbing-mode-6fe1-nlweb/index.js'],
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
    // Warn about unused exports to help find dead code
    'import/no-unused-modules': ['warn', { unusedExports: true }],
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
    {
      files: ['workers/**/*.js'],
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module'
      },
      rules: {
        // Cloudflare Workers use JSON imports which standard ESLint parser might not like without plugins
        // We can just ignore the parsing error for assert syntax if needed, but it's a parser error.
        // Actually, we can just ignore the file or the error type if we can't switch parser easily.
      }
    }
  ],
};
