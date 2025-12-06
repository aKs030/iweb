import { test, expect } from '@playwright/test';

test.describe('Fotos Page Professional', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the fotos page before each test
    await page.goto('/pages/fotos/gallery.html');
  });

  test('should load the page with correct title and hero section', async ({ page }) => {
    // Check title
    await expect(page).toHaveTitle(/Fotos/);

    // Check Hero Section
    const heroTitle = page.locator('.hero-section h1');
    await expect(heroTitle).toBeVisible();
    await expect(heroTitle).toContainText('Visuelle Momente');

    // Check Filter Bar
    const filterBar = page.locator('.filter-bar');
    await expect(filterBar).toBeVisible();

    // Check filter buttons
    const filterButtons = page.locator('.filter-btn');
    await expect(filterButtons).toHaveCount(5); // All, Landscape, Urban, Portrait, Experimental
  });

  test('should filter photo cards', async ({ page }) => {
    // Initially all cards should be visible (we wait for animation if needed)
    // The "All" filter is active by default.
    const allCards = page.locator('.photo-card');
    await expect(allCards).toHaveCount(12);

    // Filter by "Urban"
    const urbanBtn = page.locator('button[data-filter="urban"]');
    await urbanBtn.click();

    // Check that non-urban cards are hidden
    // We check for the class "hidden" or display property.
    // The script adds the 'hidden' class to excluded items.

    // Helper to check visibility based on our implementation
    const visibleCards = page.locator('.photo-card:not(.hidden)');

    // There are 3 urban cards in the HTML mock
    await expect(visibleCards).toHaveCount(3);

    // Filter back to "All"
    const allBtn = page.locator('button[data-filter="all"]');
    await allBtn.click();
    await expect(visibleCards).toHaveCount(12);
  });

  test('should open and close lightbox', async ({ page }) => {
    const firstCard = page.locator('.photo-card').first();
    const lightbox = page.locator('#lightbox');

    // Lightbox should be hidden initially
    await expect(lightbox).not.toBeVisible();

    // Click first card
    await firstCard.click();

    // Lightbox should be visible
    await expect(lightbox).toBeVisible();
    await expect(lightbox).toHaveClass(/visible/);

    // Check content inside lightbox
    const lightboxTitle = page.locator('#lightbox-title');
    await expect(lightboxTitle).toBeVisible();
    // The title should match the card clicked
    const cardTitle = await firstCard.locator('.card-title').textContent();
    await expect(lightboxTitle).toHaveText(cardTitle || '');

    // Close lightbox
    const closeBtn = page.locator('#lightbox-close');
    await closeBtn.click();

    // Lightbox should be hidden
    await expect(lightbox).not.toBeVisible();
  });
});
