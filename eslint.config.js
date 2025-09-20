import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        window: 'readonly',
        document: 'readonly',
        console: 'readonly',
        fetch: 'readonly',
        URLSearchParams: 'readonly',
        IntersectionObserver: 'readonly',
        MutationObserver: 'readonly',
        ResizeObserver: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        setTimeout: 'readonly',
        setInterval: 'readonly',
        clearTimeout: 'readonly',
        clearInterval: 'readonly',
        performance: 'readonly',
        navigator: 'readonly',
        CSS: 'readonly',
        CustomEvent: 'readonly',
        addEventListener: 'readonly',
        removeEventListener: 'readonly',
        getComputedStyle: 'readonly',
        innerHeight: 'readonly',
        innerWidth: 'readonly',
        Event: 'readonly',
        Element: 'readonly',
        HTMLElement: 'readonly',
        NodeList: 'readonly'
      }
    },
    rules: {
      'no-unused-vars': ['error', { 
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_'
      }],
      'no-console': 'warn',
      'indent': ['error', 2],
      'quotes': ['error', 'single'],
      'semi': ['error', 'always']
    },
    files: ['content/**/*.js', 'pages/**/*.js', 'scripts/**/*.js']
  },
  {
    // Ignore patterns
    ignores: ['node_modules/**', '.git/**']
  }
];