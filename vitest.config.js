import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: './tests/setup.js',
    coverage: {
      provider: 'c8',
      reporter: ['text', 'lcov', 'html', 'json'],
      include: ['**/*.{js,ts}'],
      exclude: ['**/*.min.js', 'dist/**']
    },
  // keine Plugins nötig für UI ab Vitest v1
  }
});

