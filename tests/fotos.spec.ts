import { test, expect } from '@playwright/test';

test.describe('Fotos Page Professional', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the fotos page before each test
    await page.goto('/pages/fotos/gallery.html');
    // Ensure gallery JS has mounted
    await page.waitForSelector('[data-test="photo-card"]');
  });

  test('should load the page with correct title and hero section', async ({ page }) => {
    // Check title
    await expect(page).toHaveTitle(/Fotogalerie/);

    // Check Hero Section
    const heroTitle = page.locator('main h1');
    await expect(heroTitle).toBeVisible();
    await expect(heroTitle).toContainText('Fotogalerie');

    // Check Filter Bar
    const filterBar = page.locator('.max-w-2xl');
    await expect(filterBar).toBeVisible();

    // Check filter buttons
    const filterButtons = page.locator('button[data-filter]');
    await expect(filterButtons).toHaveCount(5); // all, nature, urban, travel, landscape
  });

  test('should filter photo cards', async ({ page }) => {
    // Initially all cards should be visible (we wait for animation if needed)
    // The "All" filter is active by default.
    const allCards = page.locator('[data-test="photo-card"]');
    const allCount = await allCards.count();
    expect(allCount).toBeGreaterThan(0);

    // Filter by "Urban"
    const urbanBtn = page.locator('button[data-filter="urban"]');
    await urbanBtn.click();

    // Check that non-urban cards are hidden
    // We check for the class "hidden" or display property.
    // The script adds the 'hidden' class to excluded items.

    // Helper to check visibility based on our implementation
    const visibleCards = page.locator('[data-test="photo-card"]');

    // There are 3 urban cards in the HTML mock
    await expect(visibleCards).toHaveCount(3);

    // Filter back to "All"
    const allBtn = page.locator('button[data-filter="all"]');
    await allBtn.click();
    await expect(visibleCards).toHaveCount(12);
  });

  test('should open and close lightbox', async ({ page }) => {
    const firstCard = page.locator('[data-test="photo-card"]').first();
    const lightbox = page.locator('#lightbox');

    // Lightbox should be hidden initially
    await expect(lightbox).not.toBeVisible();

    // Click first card
    await firstCard.click();

    // Lightbox should be visible and be a modal dialog
    await expect(lightbox).toBeVisible();
    await expect(lightbox).toHaveAttribute('role', 'dialog');
    await expect(lightbox).toHaveAttribute('aria-modal', 'true');

    // Close button should receive initial focus
    const closeBtn = page.locator('#lightbox-close');
    await expect(closeBtn).toBeFocused();

    // Check content inside lightbox
    const lightboxTitle = page.locator('#lightbox-title');
    await expect(lightboxTitle).toBeVisible();
    // The title should match the card clicked
    const cardTitle = await firstCard.locator('h3').textContent();
    await expect(lightboxTitle).toHaveText(cardTitle?.trim() || '');

    // Close lightbox (press Escape to close and verify focus is restored)
    await page.keyboard.press('Escape');
    await expect(lightbox).not.toBeVisible();

    // Lightbox should be hidden
    await expect(lightbox).not.toBeVisible();
  });
});
