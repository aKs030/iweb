module.exports = {
  root: true,
  ignorePatterns: ['node_modules/', 'dist/', 'build/', 'coverage/', '.nyc_output/', 'content/config/videos-part-*.js', 'workers/**'],
  env: { es2022: true, node: true, browser: true },
  extends: ['eslint:recommended', 'plugin:prettier/recommended', 'plugin:import/recommended'],
  plugins: ['prettier', 'import'],
  parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
  globals: { 
    gtag: 'readonly', 
    announce: 'readonly', 
    makeAbortController: 'readonly',
    React: 'readonly',
    ReactDOM: 'readonly'
  },
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
      rules: { 
        'import/no-unresolved': 'off',
        // Allow unused exports in utility modules as they're designed to be reusable
        'import/no-unused-modules': 'off',
        // Allow redeclaring React globals in JSX files
        'no-redeclare': 'off'
      },
    },
  ],
};
