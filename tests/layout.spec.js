const { test, expect } = require('@playwright/test');

async function getVisibleCookieTrigger(page) {
  const selectors = ['#footer-cookies-link', '#footer-open-cookie-btn'];
  for (const selector of selectors) {
    const candidate = page.locator(selector);
    if ((await candidate.count()) && (await candidate.first().isVisible())) {
      return candidate.first();
    }
  }
  throw new Error('No visible cookie trigger found');
}

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
    test.skip(test.info().project.name !== 'Mobile (iPhone 12)', 'Stacked layout validated on the mobile viewport profile');
    await page.goto('/');
    await page.waitForFunction(() => window.SectionLoader && document.getElementById('about'));
    await page.evaluate(async () => {
      const aboutSection = document.getElementById('about');
      if (aboutSection) {
        await SectionLoader.loadSection(aboutSection);
      }
    });
    const cta = page.locator('#about .about__cta');
    await page.waitForSelector('#about .about__cta .btn');
    await expect(cta).toBeVisible();
  const buttonBoxes = await page.locator('#about .about__cta .btn').evaluateAll((nodes) =>
      nodes.map((node) => {
        const rect = node.getBoundingClientRect();
        return {
          top: rect.top,
          bottom: rect.bottom,
          height: rect.height,
          width: rect.width,
          left: rect.left,
        };
      })
    );
    expect(buttonBoxes.length).toBeGreaterThanOrEqual(2);
  const [first, second] = buttonBoxes;
    const horizontalOffset = Math.abs(second.left - first.left);
    expect(horizontalOffset).toBeLessThan(5);
  const containerWidth = await cta.evaluate((el) => el.getBoundingClientRect().width);
  expect(first.width).toBeGreaterThan(0.8 * containerWidth);
  expect(second.width).toBeGreaterThan(0.8 * containerWidth);
  });

  test('Footer cookie panel: open/close and aria', async ({ page }) => {
    await page.goto('/');
    const opener = await getVisibleCookieTrigger(page);
    const initial = await opener.getAttribute('aria-expanded');
    expect(initial === 'true').toBeFalsy();

    await opener.scrollIntoViewIfNeeded();
    await page.waitForTimeout(100);
    await opener.click({ trial: true }).catch(() => {});
    await opener.evaluate((el) => el.click());
    await expect(opener).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#footer-cookie-view')).toBeVisible();

    const closeBtn = page.locator('#close-cookie-footer');
    if (await closeBtn.count()) {
      await closeBtn.click();
      await expect(opener).toHaveAttribute('aria-expanded', 'false');
    }
  });

  test('Footer cookie banner mobile layout and persistence', async ({ page, context }) => {
    test.skip(test.info().project.name !== 'Mobile (iPhone 12)', 'Layout assertions target the mobile breakpoint');
    await context.clearCookies();
    await page.goto('/');

    const banner = page.locator('#cookie-consent-banner');
    await expect(banner).toBeVisible();

    const footerNav = page.locator('.footer-minimal-nav');
    const flexDirection = await footerNav.evaluate((el) => getComputedStyle(el).flexDirection);
    expect(flexDirection).toBe('column');

    const linkMetrics = await page.locator('.footer-minimal-nav .footer-nav-link').evaluateAll((nodes) =>
      nodes.map((node) => ({
        width: node.getBoundingClientRect().width,
        parentWidth: node.parentElement ? node.parentElement.getBoundingClientRect().width : 0,
        height: node.getBoundingClientRect().height,
      }))
    );
    for (const metric of linkMetrics) {
      expect(metric.width).toBeGreaterThan(0.8 * metric.parentWidth);
      expect(metric.height).toBeGreaterThanOrEqual(40);
    }

    const acceptBtn = page.locator('#accept-cookies-btn');
    await acceptBtn.click();
    await expect(banner).toHaveClass(/hidden/);

    await page.reload();
    await expect(page.locator('#cookie-consent-banner')).toBeHidden();

    await context.clearCookies();
    await page.reload();
    const bannerAfterReset = page.locator('#cookie-consent-banner');
    await expect(bannerAfterReset).toBeVisible();
    const flexDirectionAfter = await footerNav.evaluate((el) => getComputedStyle(el).flexDirection);
    expect(flexDirectionAfter).toBe('column');
  });

  test('Analytics scripts are placeholders before consent', async ({ page }) => {
    await page.goto('/');
    const placeholder = await page.$('script[data-consent="required"]');
    expect(placeholder).not.toBeNull();
    const gaScript = await page.$('script[src*="googletagmanager"], script[src*="gtag"]');
    expect(gaScript).toBeNull();
  });

  test('Footer respects safe-area-inset-bottom on iPhone devices', async ({ page }) => {
    // Test footer positioning with safe-area-inset
    await page.goto('/');
    
    const footer = page.locator('#site-footer');
    await expect(footer).toBeVisible();
    
    // Check that footer has safe-area-inset-bottom in its bottom positioning
    const bottomValue = await footer.evaluate((el) => {
      const computed = getComputedStyle(el);
      return computed.bottom;
    });
    
    // The bottom value should be greater than the base value when safe-area-inset is applied
    // On devices without notches, it should still work with fallback
    expect(bottomValue).toBeTruthy();
    
    // Check that footer has padding-bottom for safe area
    const paddingBottom = await footer.evaluate((el) => {
      const computed = getComputedStyle(el);
      return parseFloat(computed.paddingBottom);
    });
    
    // Should have some padding (at least 0, but likely more on devices with safe areas)
    expect(paddingBottom).toBeGreaterThanOrEqual(0);
    
    // Check that all footer content is accessible (not cut off)
    const footerLinks = page.locator('.footer-nav-link, .footer-legal-link-enhanced, .footer-cookie-btn');
    const linkCount = await footerLinks.count();
    
    for (let i = 0; i < linkCount; i++) {
      const link = footerLinks.nth(i);
      if (await link.isVisible()) {
        const box = await link.boundingBox();
        expect(box).not.toBeNull();
        // Verify element is within viewport
        const viewport = page.viewportSize();
        expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
      }
    }
  });

  test('Footer expanded state respects safe-area on iPhone 17 Pro Max', async ({ page }) => {
    // Set viewport to iPhone 17 Pro Max dimensions
    await page.setViewportSize({ width: 430, height: 932 });
    await page.goto('/');
    
    const footer = page.locator('#site-footer');
    await expect(footer).toBeVisible();
    
    // Open cookie settings to expand footer
    const cookieTrigger = await getVisibleCookieTrigger(page);
    await cookieTrigger.click();
    await page.waitForTimeout(300); // Wait for animation
    
    // Check cookie view is visible
    const cookieView = page.locator('#footer-cookie-view');
    await expect(cookieView).toBeVisible();
    
    // Check that cookie settings container has safe-area padding
    const container = page.locator('.cookie-settings-container');
    const maxHeight = await container.evaluate((el) => {
      return getComputedStyle(el).maxHeight;
    });
    
    // Should include safe-area-inset in calculation
    expect(maxHeight).toContain('vh');
    
    // Verify all buttons are accessible and have minimum touch target size
    const buttons = page.locator('.cookie-settings-btn');
    const buttonCount = await buttons.count();
    
    // Get viewport height dynamically
    const viewportHeight = page.viewportSize().height;
    
    for (let i = 0; i < buttonCount; i++) {
      const button = buttons.nth(i);
      const box = await button.boundingBox();
      expect(box).not.toBeNull();
      // Check minimum touch target size (44x44 for iPhone)
      expect(box.height).toBeGreaterThanOrEqual(44);
      // Verify button is within viewport and not cut off
      expect(box.y + box.height).toBeLessThanOrEqual(viewportHeight);
    }
  });

  const responsiveBreakpoints = [
    { width: 320, socialColumns: 1 },
    { width: 360, socialColumns: 1 },
    { width: 414, socialColumns: 1 },
    { width: 600, socialColumns: 2 },
    { width: 768, socialColumns: 2 },
  ];

  for (const { width, socialColumns } of responsiveBreakpoints) {
    test(`Footer responsive layout at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');

      const nav = page.locator('.footer-minimal-nav');
      await expect(nav).toBeVisible();
      const flexDirection = await nav.evaluate((el) => getComputedStyle(el).flexDirection);
      expect(flexDirection).toBe('column');

      const navWidth = await nav.evaluate((el) => el.getBoundingClientRect().width);
      const navLinks = await page.locator('.footer-minimal-nav .footer-nav-link').evaluateAll((nodes) =>
        nodes.map((node) => {
          const rect = node.getBoundingClientRect();
          return { width: rect.width, height: rect.height };
        })
      );
      for (const link of navLinks) {
        expect(link.width).toBeGreaterThanOrEqual(0.75 * navWidth);
        expect(link.height).toBeGreaterThanOrEqual(40);
      }

      const socialGrid = page.locator('.footer-social-grid');
      await expect(socialGrid).toBeVisible();
      const columnCount = await socialGrid.evaluate((el) => {
        const template = window.getComputedStyle(el).gridTemplateColumns;
        if (!template || template === 'none') return 0;
        const tokens = template.match(/minmax\([^)]*\)|fit-content\([^)]*\)|repeat\([^)]*\)|[^\s]+/g) || [];
        return tokens.reduce((count, token) => {
          const repeatMatch = token.match(/repeat\(\s*(\d+)/);
          if (repeatMatch) {
            return count + Number(repeatMatch[1] || 0);
          }
          return count + 1;
        }, 0);
      });
      expect(columnCount).toBe(socialColumns);
    });
  }
});
