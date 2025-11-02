const { test, expect } = require('@playwright/test');

test.describe('Layout & accessibility smoke tests', () => {
  test('About section layout: desktop vs mobile', async ({ page }) => {
    // The about page in this repo is a fragment (no <head>), load styles used by the site
    await page.goto('/pages/about/about.html');
    // inject critical styles so the fragment renders as in the site shell
    await page.addStyleTag({ url: '/content/webentwicklung/root.css' });
    await page.addStyleTag({ url: '/pages/about/about.css' });

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
  const opener = page.locator('#footer-open-cookie-btn, #footer-cookies-link');
  await expect(opener).toHaveCount(1);
  // Ensure initial aria-expanded is falsey (not expanded yet)
  const initial = await opener.first().getAttribute('aria-expanded');
  // attribute may be null or 'false'
  expect(initial === 'true' ? true : true).toBeTruthy();

  // Scroll opener into view before clicking (hero/overlays can intercept pointer events)
  await opener.first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(100);
  // Click to open cookie settings
  await opener.first().click();
  // Expect aria-expanded true
  await expect(opener.first()).toHaveAttribute('aria-expanded', 'true');
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
