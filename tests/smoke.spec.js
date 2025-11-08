const { test, expect } = require('@playwright/test');

test('homepage has correct title', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Abdul aus Berlin - Webentwicklung & Fotografie');
});
