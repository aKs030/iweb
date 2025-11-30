import { test, expect } from '@playwright/test';

test.describe('Footer trigger zone', () => {
  test('should be auto-inserted when footer-container exists', async ({ page }) => {
    await page.goto('/pages/projekte/projekte.html');
    // Wait for site-footer to be injected by the footer loader
    await page.waitForSelector('#site-footer', { timeout: 10000 });

    // Wait for the trigger (auto-inserted if missing). element may be hidden (aria-hidden=true)
    const trigger = await page.waitForSelector('#footer-trigger-zone', {
      state: 'attached',
      timeout: 10000
    });
    expect(trigger).not.toBeNull();

    // Also ensure that the site-footer exists
    const footer = await page.$('#site-footer');
    expect(footer).not.toBeNull();
  });
});
