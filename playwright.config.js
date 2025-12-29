import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./scripts/tests",
  outputDir: "./scripts/test-results",
  webServer: {
    command: "npm run serve:dev",
    port: 8081,
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
  use: {
    headless: true,
    viewport: { width: 1280, height: 720 },
  },
});
