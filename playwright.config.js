const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: 'tests',
  timeout: 30 * 1000,
  use: {
    baseURL: 'http://localhost:8080',
    headless: true,
    ignoreHTTPSErrors: true
  },
  webServer: {
    command: 'npx http-server ./ -p 8080',
    port: 8080,
    reuseExistingServer: !process.env.CI
  },
  projects: [
    {
      name: 'Desktop Chrome',
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'Mobile (iPhone 12)',
      use: { ...devices['iPhone 12'] }
    }
  ]
});
