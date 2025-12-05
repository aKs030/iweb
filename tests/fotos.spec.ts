import { test, expect } from '@playwright/test';

test.describe('Fotos Page', () => {
  test('should load the fotos page correctly', async ({ page }) => {
    // Navigate to the fotos page
    await page.goto('/pages/fotos/fotos.html');

    // Check if the title is correct
    await expect(page).toHaveTitle(/Fotos/);

    // Check if the page title heading is present and visible
    // The h1 is inside .page-header, not the site header
    const pageTitle = page.locator('h1.page-title');
    await expect(pageTitle).toBeVisible();
    await expect(pageTitle).toHaveText('Fotos');

    // Check for the presence of the photo grid
    const grid = page.locator('.photo-grid');
    await expect(grid).toBeVisible();

    // Check if there are photo cards (should be 12)
    const cards = page.locator('.photo-card');
    await expect(cards).toHaveCount(12);

    // Check that we are in dark mode (background color check)
    // We expect the body to have the dark background color we forced
    const body = page.locator('body');
    await expect(body).toHaveCSS('background-color', 'rgb(10, 10, 10)');
  });
});
