// ESLint flat config (v9+)
import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        // Browser globals
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        console: 'readonly',
        globalThis: 'readonly',
        performance: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        requestIdleCallback: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        CustomEvent: 'readonly',
        Event: 'readonly',
        MutationObserver: 'readonly',
        IntersectionObserver: 'readonly',
        ResizeObserver: 'readonly',
        localStorage: 'readonly',
        location: 'readonly',
        gtag: 'readonly',
        alert: 'readonly',
        getComputedStyle: 'readonly',
        innerHeight: 'readonly',
        atob: 'readonly',
        btoa: 'readonly',
        DOMParser: 'readonly',
        AbortController: 'readonly',
        OffscreenCanvas: 'readonly',
        HTMLElement: 'readonly',
        KeyboardEvent: 'readonly',
        // Node.js globals (for scripts)
        process: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        require: 'readonly',
        module: 'readonly',
        exports: 'readonly',
        // Service Worker globals
        self: 'readonly',
        caches: 'readonly',
        // Cloudflare Worker globals
        Request: 'readonly',
        Response: 'readonly',
        Headers: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': 'off',
      'no-debugger': 'warn',
      'prefer-const': 'warn',
      'no-var': 'error',
      'no-empty': ['warn', { allowEmptyCatch: true }],
      
      // Deprecated API patterns
      'no-restricted-syntax': [
        'error',
        {
          selector: 'MemberExpression[object.name="matchMedia"] > Identifier[name="addListener"]',
          message: 'matchMedia.addListener() is deprecated. Use addEventListener() instead.',
        },
        {
          selector: 'MemberExpression[object.name="matchMedia"] > Identifier[name="removeListener"]',
          message: 'matchMedia.removeListener() is deprecated. Use removeEventListener() instead.',
        },
      ],
      
      // Discourage direct globalThis usage (suggest window.AKS namespace)
      'no-restricted-globals': [
        'warn',
        {
          name: '__threeEarthCleanup',
          message: 'Use window.AKS.threeEarthCleanup instead of globalThis.__threeEarthCleanup',
        },
        {
          name: '__FORCE_THREE_EARTH',
          message: 'Use window.AKS.forceThreeEarth instead of globalThis.__FORCE_THREE_EARTH',
        },
      ],
    },
  },
  {
    // Test files configuration
    files: ['**/*.test.js', '**/*.spec.js', 'vitest.setup.js'],
    languageOptions: {
      globals: {
        vi: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        test: 'readonly',
      },
    },
  },
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'build/**',
      '.git/**',
      'workers/throbbing-mode-6fe1-nlweb/**',
    ],
  },
];
