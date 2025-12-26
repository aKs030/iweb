// Flat config equivalent to the project's legacy .eslintrc
// This avoids mixed-config detection issues across different Node/ESLint environments.
module.exports = [
  {
    ignores: ['node_modules/**', 'dist/**', 'build/**', 'content/vendor/**', 'public/**', '.venv/**', '.venv', 'content/vendor', 'dist', 'build', 'node_modules']
  },
  {
    files: ['**/*.js'],
    languageOptions: {
      sourceType: 'module',
      ecmaVersion: 2024
    },
    rules: {
      'no-console': ['warn', {allow: ['warn', 'error']}],
      'no-unused-vars': ['warn', {varsIgnorePattern: '^_', argsIgnorePattern: '^_'}],
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'prefer-const': 'warn',
      'no-var': 'warn',
      'no-undef': 'error'
    }
  },
  // Browser-specific files: enable browser globals (document/window/fetch/etc.)
  {
    files: ['content/**', 'pages/**', 'content/components/**', 'content/**/**'],
    languageOptions: {
      ecmaVersion: 2024,
      globals: {
        window: 'readonly',
        document: 'readonly',
        fetch: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        performance: 'readonly',
        IntersectionObserver: 'readonly',
        IntersectionObserverEntry: 'readonly',
        URL: 'readonly',
        location: 'readonly',
        navigator: 'readonly',
        requestIdleCallback: 'readonly',
        CustomEvent: 'readonly',
        innerHeight: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        atob: 'readonly',
        btoa: 'readonly',
        URLSearchParams: 'readonly',
        MutationObserver: 'readonly',
        OffscreenCanvas: 'readonly',
        AbortController: 'readonly',
        ResizeObserver: 'readonly',
        caches: 'readonly',
        alert: 'readonly',
        console: 'readonly',
        dataLayer: 'readonly',
        getComputedStyle: 'readonly'      }
    }
  },
  // Node scripts and test files
  {
    files: ['scripts/**', 'tests/**', 'playwright.config.js', '.github/**'],
    languageOptions: {
      ecmaVersion: 2024,
      globals: {
        require: 'readonly',
        module: 'readonly',
        process: 'readonly',
        console: 'readonly',
        Buffer: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        window: 'readonly',
        document: 'readonly',
        IntersectionObserver: 'readonly'
      }
    }
  },
  // React globals for pages that rely on global React from vendor script
  {
    files: ['pages/**', 'content/**/gallery/**'],
    languageOptions: {
      globals: { React: 'readonly', ReactDOM: 'readonly' }
    }
  }
]
