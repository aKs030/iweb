import { test, expect } from '@playwright/test';

test.describe('Menu System (Mobile)', () => {
  // Enforce mobile viewport for menu toggle tests
  test.use({ viewport: { width: 375, height: 667 } });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');

    // CRITICAL FIX: Wait for loading screen to disappear before interacting
    // The loading screen has a high z-index and blocks clicks
    const loader = page.locator('#loadingScreen');
    await expect(loader).toBeHidden({ timeout: 10000 });

    await page.waitForSelector('#menu-container .site-menu');
  });

  test('should toggle menu open and closed', async ({ page }) => {
    const toggleBtn = page.locator('.site-menu__toggle');
    const menu = page.locator('.site-menu');

    // Initial state
    await expect(menu).toHaveClass(/site-menu/);
    await expect(menu).not.toHaveClass(/open/);
    await expect(toggleBtn).toHaveAttribute('aria-expanded', 'false');

    // Open menu
    await toggleBtn.click();
    await expect(menu).toHaveClass(/open/);
    await expect(toggleBtn).toHaveAttribute('aria-expanded', 'true');

    // Close menu
    await toggleBtn.click();
    await expect(menu).not.toHaveClass(/open/);
    await expect(toggleBtn).toHaveAttribute('aria-expanded', 'false');
  });

  test('should close menu when clicking outside', async ({ page }) => {
    const toggleBtn = page.locator('.site-menu__toggle');
    const menu = page.locator('.site-menu');

    // Open menu
    await toggleBtn.click();
    await expect(menu).toHaveClass(/open/);

    // Click on main content (definitely outside menu)
    // We force the click because sometimes elements might be covered by other overlays in tests
    await page.locator('#main-content').click({ force: true, position: { x: 10, y: 10 } });

    // Check if closed
    await expect(menu).not.toHaveClass(/open/);
  });

  test('should close menu when clicking a link', async ({ page }) => {
    const toggleBtn = page.locator('.site-menu__toggle');
    const menu = page.locator('.site-menu');

    // Open menu
    await toggleBtn.click();

    // Find a link inside the menu
    const link = menu.locator('a[href]').first();
    // Ensure link is visible before clicking
    await expect(link).toBeVisible();
    await link.click();

    await expect(menu).not.toHaveClass(/open/);
  });
});

test.describe('Menu System (General)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for loader here too
    await expect(page.locator('#loadingScreen')).toBeHidden({ timeout: 10000 });
    await page.waitForSelector('#menu-container .site-menu');
  });

  test('should set active link based on scroll/navigation', async ({ page }) => {
    // Force a hash navigation which is handled by JS without page reload
    await page.goto('/#about');

    // Allow small time for IntersectionObserver or hashchange event to fire
    await page.waitForTimeout(300);

    const aboutLink = page.locator('.site-menu a[href="#about"]');
    await expect(aboutLink).toHaveClass(/active/);
  });
});
