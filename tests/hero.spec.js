const { test, expect } = require('@playwright/test');

test.describe('Hero lazy and greeting', () => {
  test('Hero greeting updates from default on page load', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#greetingText', { timeout: 7000 });
    const initial = await page.locator('#greetingText').textContent();

    if (initial && initial.trim() !== 'Willkommen') {
      // already changed
      expect(initial.trim().length).toBeGreaterThan(0);
      return;
    }

    // Await change to not equal default
    await page.waitForFunction(() => {
      const el = document.getElementById('greetingText');
      return el && el.textContent && el.textContent.trim() !== 'Willkommen';
    }, null, { timeout: 8000 });

    const updated = await page.locator('#greetingText').textContent();
    expect(updated.trim().length).toBeGreaterThan(0);
    expect(updated.trim()).not.toBe('Willkommen');
  });
});
