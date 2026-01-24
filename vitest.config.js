import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    // Test environment
    environment: 'happy-dom', // Faster than jsdom
    
    // Global test APIs (describe, it, expect, etc.)
    globals: true,
    
    // Setup files
    setupFiles: ['./vitest.setup.js'],
    
    // Property-based testing configuration
    // fast-check will run at least 100 iterations per property test
    propertyTesting: {
      iterations: 100,
      seed: Date.now(), // Reproducible randomness
    },
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov', 'json'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/**',
        'dist/**',
        'coverage/**',
        '**/*.test.js',
        '**/*.spec.js',
        '**/*.properties.js', // Exclude property test files from coverage
        'vitest.config.js',
        'vite.config.js',
        'vitest.setup.js',
        'scripts/**',
        'workers/**',
        'content/utils/test-utils/**', // Exclude test utilities
      ],
      include: [
        'content/**/*.js',
        'pages/**/*.js',
      ],
      // Coverage thresholds - 60% for all metrics
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 60,
        statements: 60,
      },
    },
    
    // Test file patterns - include property test files
    include: [
      '**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      '**/*.properties.js', // Include property-based test files
    ],
    
    // Exclude patterns
    exclude: [
      'node_modules/**',
      'dist/**',
      'coverage/**',
      'workers/**',
    ],
    
    // Test timeout
    testTimeout: 10000,
    
    // Hook timeout
    hookTimeout: 10000,
    
    // Reporters
    reporters: ['verbose'],
    
    // Watch mode
    watch: false,
    
    // Mock configuration
    mockReset: true,
    restoreMocks: true,
    clearMocks: true,
  },
  
  // Resolve configuration (same as Vite)
  resolve: {
    alias: {
      '@': resolve(__dirname, './content'),
      '@components': resolve(__dirname, './content/components'),
      '@utils': resolve(__dirname, './content/utils'),
      '@styles': resolve(__dirname, './content/styles'),
      '@pages': resolve(__dirname, './pages'),
    },
  },
});
