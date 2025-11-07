const { test, expect } = require('@playwright/test');

test.describe('Footer scroll bug verification', () => {
  test('Opening cookie settings does not scroll the page', async ({ page }) => {
    await page.goto('/');

    // Add content to make the page scrollable
    await page.evaluate(() => {
      const longContent = document.createElement('div');
      longContent.style.height = '3000px';
      longContent.textContent = 'Scrolling content...';
      document.body.prepend(longContent);
      window.scrollTo(0, 0);
    });

    const initialScrollY = await page.evaluate(() => window.scrollY);
    expect(initialScrollY).toBe(0);

    const opener = page.locator('[data-cookie-trigger]');
    await opener.first().click();

    // Wait for the scroll animation to complete
    await page.waitForTimeout(500);

    const finalScrollY = await page.evaluate(() => window.scrollY);
    expect(finalScrollY).toBe(0);
  });
});
