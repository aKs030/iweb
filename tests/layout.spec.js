const { test, expect } = require('@playwright/test');

test.describe('Layout & accessibility smoke tests', () => {
  test('About section layout: desktop vs mobile', async ({ page }) => {
    await page.goto('/pages/about/about.html');

    // Check h1 exists and has readable font-size
    const h1 = page.locator('.about__text h1');
    await expect(h1).toBeVisible();
    const fontSize = await h1.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(fontSize).toBeGreaterThan(16);

    // .about__cta should be visible
    const cta = page.locator('.about__cta');
    await expect(cta).toBeVisible();

    // On desktop project we expect horizontal layout (not column)
    const flexDir = await cta.evaluate((el) => getComputedStyle(el).flexDirection);
    expect(flexDir).not.toBe('column');
  });

  test('About section layout: mobile (stacked buttons)', async ({ page }) => {
    await page.goto('/pages/about/about.html');
    // Playwright mobile project will emulate a narrow viewport
    const cta = page.locator('.about__cta');
    await expect(cta).toBeVisible();
    const flexDir = await cta.evaluate((el) => getComputedStyle(el).flexDirection);
    // On mobile project expect column layout
    expect(flexDir).toBe('column');
  });

  test('Footer cookie panel: open/close and aria', async ({ page }) => {
    await page.goto('/');
    // Find trigger (either top or bottom opener)
    const opener = await page.$('#footer-open-cookie-btn') || await page.$('#footer-cookies-link');
    expect(opener).toBeTruthy();
    // Ensure initial aria-expanded is false or not present
    const initial = await opener.getAttribute('aria-expanded');
    expect(initial === 'true' ? true : true).toBeTruthy();

    // Click to open cookie settings
    await opener.click();
    // Expect aria-expanded true
    await expect(opener).toHaveAttribute('aria-expanded', 'true');
    // Cookie view visible
    await expect(page.locator('#footer-cookie-view')).toBeVisible();

    // Close via close button
    const closeBtn = page.locator('#close-cookie-footer');
    if (await closeBtn.count()) {
      await closeBtn.click();
      await expect(opener).toHaveAttribute('aria-expanded', 'false');
    }
  });

  test('Analytics scripts are placeholders before consent', async ({ page }) => {
    await page.goto('/');
    const placeholder = await page.$('script[data-consent="required"]');
    expect(placeholder).not.toBeNull();
    const gaScript = await page.$('script[src*="googletagmanager"], script[src*="gtag"]');
    expect(gaScript).toBeNull();
  });
});
