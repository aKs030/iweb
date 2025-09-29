// eslint.config.js
import js from "@eslint/js";

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "module",
      globals: {
        // Browser environment globals
        window: "readonly",
        document: "readonly",
        console: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        requestAnimationFrame: "readonly",
        cancelAnimationFrame: "readonly",
        fetch: "readonly",
        location: "readonly",
        navigator: "readonly",
        performance: "readonly",
        Event: "readonly",
        CustomEvent: "readonly",
        addEventListener: "readonly",
        removeEventListener: "readonly",
        IntersectionObserver: "readonly",
        MutationObserver: "readonly",
        ResizeObserver: "readonly",
        WeakSet: "readonly",
        WeakMap: "readonly",
        URL: "readonly",
        innerWidth: "readonly",
        innerHeight: "readonly",
        
        // Portfolio-spezifische Globals
        THREE: "readonly",                 // Three.js für das Earth System
        announce: "readonly",              // window.announce für Accessibility
        enhancedAnimationEngine: "readonly" // Eigene Animation Engine API
      }
    },
    rules: {
      // Ungenutzte Variablen: alles mit "_" wird ignoriert
      "no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_"
        }
      ],

      // Moderne JavaScript Best Practices
      "prefer-const": "error",
      "no-var": "error",
      "prefer-template": "warn",
      "prefer-arrow-callback": "warn",

      // Code Style
      "no-console": ["warn", { allow: ["warn", "error"] }],
      indent: ["error", 2],
      quotes: ["error", "single"],
      semi: ["error", "always"],
      "no-multiple-empty-lines": ["error", { max: 2 }],
      "comma-dangle": ["error", "never"],

      // Performance & Qualität
      "no-duplicate-imports": "error",
      "no-useless-concat": "error",
      "prefer-destructuring": ["warn", { object: true, array: false }]
    },
    files: ["content/**/*.js", "pages/**/*.js", "scripts/**/*.js"]
  },
  {
    ignores: [
      "node_modules/**",
      ".git/**",
      "**/three.module.js",  // Three.js Library
      "**/*.min.js",         // Minifizierte Dateien
      "coverage/**",         // Test Coverage
      ".vscode/**",          // VS Code Settings
      "dist/**",             // Build Output
      "**/*.bundle.js"       // Bundle Files
    ]
  }
];