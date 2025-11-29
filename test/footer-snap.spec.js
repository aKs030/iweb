import { test, expect } from '@playwright/test';

test.describe('Footer expansion behavior', () => {
  test('should expand and remain expanded after clicking data-footer-trigger', async ({ page }) => {
    await page.goto('/');
    // Ensure the trigger exists and is visible
    // Ensure footer system and site-footer are loaded
    await page.waitForSelector('#site-footer', { state: 'attached', timeout: 5000 });
    await page.waitForFunction(() => !!window.footerScrollHandler, { timeout: 5000 });
    const trigger = await page.waitForSelector('[data-footer-trigger]', { state: 'visible', timeout: 5000 });
    // Click with force to avoid animation stability issues in the hero buttons
    // Use evaluate click to bypass Playwright visibility/intersection constraints
    await page.evaluate((sel) => { const e = document.querySelector(sel); if (e) { e.click(); } }, '[data-footer-trigger]');
    // Wait for body to get footer-expanded
    await page.waitForSelector('body.footer-expanded', { timeout: 5000 });
    // Check that the maximized content is not hidden
    await page.waitForSelector('#site-footer .footer-maximized', { state: 'attached' });
    const hasClass = await page.evaluate(() => document.body.classList.contains('footer-expanded'));
    expect(hasClass).toBe(true);
    // Wait briefly and ensure it doesn't immediately collapse
    await page.waitForTimeout(500);
    const stillExpanded = await page.evaluate(() => document.body.classList.contains('footer-expanded'));
    expect(stillExpanded).toBe(true);
  });
});
