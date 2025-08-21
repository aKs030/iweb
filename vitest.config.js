// vitest.config.ts
import { defineConfig } from 'vitest/config';

const isCI = !!process.env.CI;

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: './tests/setup.js',

    // Coverage klar definieren
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html', 'clover'],
      include: ['**/*.{js,ts}'],
      exclude: [
        '**/*.min.js',
        'dist/**',
        'tests/**',
        'node_modules/**',
        '**/*.test.{js,ts}',
        '**/*.spec.{js,ts}',
      ],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
      reportsDirectory: './coverage',
    },

    testTimeout: 5000,
    maxConcurrency: 5,
    globals: true,
    mockReset: true,
    clearMocks: true,
    restoreMocks: true,

    include: ['**/*.{test,spec}.{js,ts,jsx,tsx}'],

    watch: { ignore: ['node_modules', 'dist', 'coverage'] },

    environmentOptions: {
      jsdom: { resources: 'usable', runScripts: 'dangerously' },
    },

    // In CI NUR "default", lokal zusätzlich "html"
    reporters: isCI ? ['default'] : ['default', 'html'],
    outputFile: isCI ? undefined : { html: './test-reports/html-report.html' },
  },
});