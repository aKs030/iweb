import { test, expect } from '@playwright/test';

test.describe('Application Loading', () => {
  test('should show loading screen and then reveal content', async ({ page }) => {
    await page.goto('/');

    const loader = page.locator('#loadingScreen');
    const mainContent = page.locator('#main-content');

    // 1. Loader should be visible initially
    // We rely on the fact that Playwright is fast enough to catch it.
    // If the app is too fast (e.g. cached), this might flake, but usually
    // the MIN_DISPLAY_TIME (600ms) in main.js guarantees visibility.
    await expect(loader).toBeVisible();

    // 2. Loader should have the spinner
    const spinner = loader.locator('.loader');
    await expect(spinner).toBeVisible();

    // 3. Loader should eventually disappear (class 'hide' or display:none)
    // We give it generous timeout (10s) because 3D assets might take time on CI
    await expect(loader).toBeHidden({ timeout: 15000 });

    // 4. Main content should be accessible (no longer inert or covered)
    await expect(mainContent).toBeVisible();

    // Check if the "aria-hidden" attribute was correctly toggled on the loader
    await expect(loader).toHaveAttribute('aria-hidden', 'true');
  });

  test('should initialize critical globals', async ({ page }) => {
    await page.goto('/');

    // Wait for app to settle
    await expect(page.locator('#loadingScreen')).toBeHidden();

    const globals = await page.evaluate(() => {
      return {
        hasSectionLoader: !!window.SectionLoader,
        hasFooterSystem: !!window.FooterSystem,
        threeEarthContainerExists: !!document.getElementById('threeEarthContainer')
      };
    });

    expect(globals.hasSectionLoader).toBe(true);
    expect(globals.hasFooterSystem).toBe(true);
    expect(globals.threeEarthContainerExists).toBe(true);
  });
});
