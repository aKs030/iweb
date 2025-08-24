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
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        performance: 'readonly',
        navigator: 'readonly',
        location: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        fetch: 'readonly',
        IntersectionObserver: 'readonly',
        PerformanceObserver: 'readonly',
        matchMedia: 'readonly',
        // Additional browser globals
        devicePixelRatio: 'readonly',
        innerWidth: 'readonly',
        innerHeight: 'readonly',
        addEventListener: 'readonly',
        getComputedStyle: 'readonly',
        MutationObserver: 'readonly',
        ResizeObserver: 'readonly',
        CustomEvent: 'readonly',
        URLSearchParams: 'readonly',
        Blob: 'readonly',
        URL: 'readonly',
        crypto: 'readonly',
        // Node.js globals for tests
        global: 'readonly'
      }
    },
    rules: {
      // Mögliche Fehler
      'no-unused-vars': ['error', { 
        'argsIgnorePattern': '^_',
        'varsIgnorePattern': '^_' 
      }],
      'no-console': ['warn', { 
        'allow': ['warn', 'error'] 
      }],
      
      // Best Practices
      'eqeqeq': ['warn', 'always'], // Warn instead of error
      'no-var': 'error',
      'prefer-const': 'warn', // Warn instead of error
      'prefer-arrow-callback': 'off', // Too restrictive
      
      // ES6+ Features
      'arrow-spacing': 'warn', // Warn instead of error
      'template-curly-spacing': 'error',
      'object-shorthand': 'off', // Optional
      
      // Stylistic (relaxed for existing codebase)
      'indent': ['warn', 2, { 'SwitchCase': 1 }],
      'quotes': ['warn', 'single', { 'avoidEscape': true }],
      'semi': ['error', 'always'],
      'comma-dangle': 'off', // Allow trailing commas
      'space-before-function-paren': 'off', // Too many conflicts
    }
  },
  {
    // Test-spezifische Konfiguration
    files: ['tests/**/*.js'],
    languageOptions: {
      globals: {
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        vi: 'readonly'
      }
    },
    rules: {
      'no-console': 'off'
    }
  },
  {
    // Ignore patterns
    ignores: [
      'node_modules/**',
      'coverage/**',
      'dist/**',
      '.github/**'
    ]
  }
];
