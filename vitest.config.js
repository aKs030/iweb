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
        'vitest.config.js',
        'vite.config.js',
        'scripts/**',
        'workers/**',
      ],
      include: [
        'content/**/*.js',
        'pages/**/*.js',
      ],
      // Coverage thresholds
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 60,
        statements: 60,
      },
    },
    
    // Test file patterns
    include: [
      '**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
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
