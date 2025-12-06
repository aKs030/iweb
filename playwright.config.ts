import { defineConfig } from '@playwright/test';

export default defineConfig({
  webServer: {
    command: 'npm run serve',
    port: 8081,
    timeout: 120 * 1000,
    reuseExistingServer: !process.env.CI
  },
  use: {
    baseURL: 'http://localhost:8081'
  },
  testDir: './tests'
});
