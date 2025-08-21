import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: './tests/setup.js',
    coverage: {
      reporter: ['text', 'lcov'],
      include: ['**/*.{js,ts}'],
      exclude: ['**/*.min.js', 'dist/**']
    }
  }
});

