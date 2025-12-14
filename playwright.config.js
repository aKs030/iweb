const {defineConfig} = require('@playwright/test')
module.exports = defineConfig({
  testDir: './tests',
  webServer: {
    command: 'npm run serve',
    port: 8081,
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000
  },
  use: {
    headless: true,
    viewport: {width: 1280, height: 720}
  }
})
