import { test, expect } from '@playwright/test';

// Pages to check for horizontal overflow in small viewports
const pages = ['/', '/pages/home/hero.html', '/pages/projekte/projekte.html', '/pages/card/karten.html', '/pages/about/about.html'];

test.describe('Responsive layout - no horizontal overflow on mobile', () => {
  test.use({ viewport: { width: 390, height: 844 } }); // iPhone 12-ish

  pages.forEach((path) => {
    test(`should not horizontally overflow when rendering ${path}`, async ({ page }) => {
      await page.goto(path);

      // If the app loader exists, wait for it to hide
      const loader = page.locator('#loadingScreen');
      await expect(loader).toBeHidden({ timeout: 10000 }).catch(() => {});

      // Get the bounding debug info for the main root and container
      const result = await page.evaluate(() => {
        const root = document.querySelector('#root');
        const container = document.querySelector('.container') || root;
        const rootRect = root ? root.getBoundingClientRect() : { width: document.documentElement.clientWidth };
        const containerRect = container ? container.getBoundingClientRect() : { width: rootRect.width };
        return {
          rootWidth: rootRect.width,
          containerWidth: containerRect.width,
          innerWidth: window.innerWidth,
          documentWidth: document.documentElement.scrollWidth,
        };
      });

      // Debug log to help with future investigations
      console.info('Layout widths for', path, result);

      // The container should fit into the viewport without horizontal scroll
      expect(result.containerWidth).toBeLessThanOrEqual(result.innerWidth + 1);
      expect(result.documentWidth).toBeLessThanOrEqual(result.innerWidth + 1);
    });
  });
});
