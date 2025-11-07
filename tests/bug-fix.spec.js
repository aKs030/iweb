const { test, expect } = require('@playwright/test');

test.describe('Bug fix verification', () => {
  test('Footer cookie panel is initially closed', async ({ page }) => {
    await page.goto('/');
    const opener = page.locator('#footer-open-cookie-btn, #footer-cookies-link');
    await expect(opener).toHaveCount(1);
    const initial = await opener.first().getAttribute('aria-expanded');
    expect(initial).not.toBe('true');
  });
});
