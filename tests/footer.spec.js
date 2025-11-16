const { test, expect } = require('@playwright/test');

test.describe('Footer interactions', () => {
  test('Cookie banner opens and accept button sets cookie', async ({ page }) => {
    // start with a clean context: no cookies set
    await page.context().clearCookies();
    await page.goto('/');
    // Wait for footer to load
    await page.waitForSelector('#site-footer', { timeout: 7000 });

    // The cookie banner may be hidden initially; trigger a cookie-show by clicking cookie trigger
    const cookieTrigger = await page.$('[data-cookie-trigger]');
    expect(cookieTrigger).toBeTruthy();

    await cookieTrigger.click();

    // The cookie trigger opens the cookie settings dialog
    await expect(page.locator('#footer-cookie-view')).toBeVisible({ timeout: 3000 });

    await page.click('#footer-accept-all');

    // Check cookie has been set
    const cookies = await page.evaluate(() => document.cookie);
    expect(cookies).toContain('cookie_consent=accepted');
  });

  test('Cookie reject path keeps analytics blocked', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/');
    await page.waitForSelector('#site-footer', { timeout: 7000 });

    const cookieTrigger = await page.$('[data-cookie-trigger]');
    await cookieTrigger.click();
    await expect(page.locator('#footer-cookie-view')).toBeVisible({ timeout: 3000 });

    await page.click('#footer-reject-all');

    const cookies = await page.evaluate(() => document.cookie);
    expect(cookies).toContain('cookie_consent=rejected');

    // Scripts that are blocked by data-consent should remain type=\"text/plain\"
    const blocked = await page.$$eval('script[data-consent="required"]', (els) =>
      els.map((e) => e.getAttribute('type'))
    );
    expect(blocked.every((t) => t === 'text/plain')).toBeTruthy();
  });

  test('Contact button opens maximized footer', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#site-footer', { timeout: 7000 });

    const contactBtn = await page.$('[data-footer-trigger]');
    expect(contactBtn).toBeTruthy();

    await contactBtn.click();

    // After clicking, site footer should expand
    await page.waitForSelector(
      '#site-footer.footer-expanded, .footer-maximized:not(.footer-hidden)',
      { timeout: 3000 }
    );

    // ensure ARIA expanded attribute set on trigger
    const expanded = await contactBtn.getAttribute('aria-expanded');
    expect(expanded).toBe('true');
  });
});
