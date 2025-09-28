import js from "@eslint/js";

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2024, // Modernste JavaScript-Version
      sourceType: "module",
      globals: {
        window: "readonly",
        document: "readonly",
        console: "readonly",
        fetch: "readonly",
        URLSearchParams: "readonly",
        IntersectionObserver: "readonly",
        MutationObserver: "readonly",
        ResizeObserver: "readonly",
        requestAnimationFrame: "readonly",
        cancelAnimationFrame: "readonly",
        setTimeout: "readonly",
        setInterval: "readonly",
        clearTimeout: "readonly",
        clearInterval: "readonly",
        performance: "readonly",
        navigator: "readonly",
        CSS: "readonly",
        CustomEvent: "readonly",
        addEventListener: "readonly",
        removeEventListener: "readonly",
        getComputedStyle: "readonly",
        innerHeight: "readonly",
        innerWidth: "readonly",
        Event: "readonly",
        Element: "readonly",
        HTMLElement: "readonly",
        NodeList: "readonly",
        // Portfolio-spezifische Globals
        THREE: "readonly", // Three.js für das Earth System
        announce: "readonly", // window.announce für Accessibility
        enhancedAnimationEngine: "readonly", // Animation Engine API
      },
    },
    rules: {
      // Ungenutzte Variablen mit Underscore-Pattern
      "no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      // Moderne JavaScript Best Practices
      "prefer-const": "error",
      "no-var": "error",
      "prefer-template": "warn",
      "prefer-arrow-callback": "warn",
      // Code Style
      "no-console": "warn",
      indent: ["error", 2],
      quotes: ["error", "single"],
      semi: ["error", "always"],
      "no-multiple-empty-lines": ["error", { max: 2 }],
      "comma-dangle": ["error", "never"],
      // Performance & Qualität
      "no-duplicate-imports": "error",
      "no-useless-concat": "error",
      "prefer-destructuring": ["warn", { object: true, array: false }],
    },
    files: ["content/**/*.js", "pages/**/*.js", "scripts/**/*.js"],
  },
  {
    // Performance-optimierte Ignore Patterns
    ignores: [
      "node_modules/**",
      ".git/**",
      "**/three.module.js", // Three.js Library
      "**/*.min.js", // Minifizierte Dateien
      "coverage/**", // Test Coverage
      ".vscode/**", // VS Code Settings
      "dist/**", // Build Output
      "**/*.bundle.js", // Bundle Files
    ],
  },
];
