import { test, expect } from '@playwright/test';

test.describe('Menu footer open', () => {
  test('clicking nav "Kontakt" should open the maximized footer', async ({ page }) => {
    await page.goto('/');
    // Wait for the menu and the contact anchor
    // Wait for the footer system and contact anchor to be ready
    await page.waitForSelector('#site-footer', { state: 'attached', timeout: 5000 });
    await page.waitForFunction(() => !!window.footerScrollHandler, { timeout: 5000 });
    await page.waitForSelector('#navigation a[href="#site-footer"]', { state: 'visible', timeout: 5000 });
    // Some layouts may have the header fixed; ensure visible and click reliably
    // Click programmatically to avoid overlay/viewport issues
    await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (el) el.click();
    }, '#navigation a[href="#site-footer"]');
    // The footer should expand and body should have class
    await page.waitForSelector('body.footer-expanded', { timeout: 5000 });
    const expanded = await page.evaluate(() => document.body.classList.contains('footer-expanded'));
    expect(expanded).toBe(true);
    // Ensure it stays expanded for a short time
    await page.waitForTimeout(400);
    const stillExpanded = await page.evaluate(() =>
      document.body.classList.contains('footer-expanded')
    );
    expect(stillExpanded).toBe(true);
  });
});
