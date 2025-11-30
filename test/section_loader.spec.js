import { test, expect } from '@playwright/test';

const TEST_FRAGMENT_URL = 'content/test-fragment.html';
const INVALID_URL = 'content/does-not-exist.html';

test.describe('SectionLoader', () => {
  test.beforeEach(async ({ page }) => {
    // Setup routes before navigation
    await page.route(TEST_FRAGMENT_URL, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<div class="test-content">Hello World</div><template><span class="extra">Extra</span></template>'
      });
    });

    await page.route(INVALID_URL, async (route) => {
      await route.fulfill({
        status: 404,
        body: 'Not Found'
      });
    });

    await page.goto('/');
  });

  test('should load valid section content', async ({ page }) => {
    // Inject a new section into the DOM
    await page.evaluate((url) => {
      const section = document.createElement('section');
      section.id = 'test-section-valid';
      section.setAttribute('data-section-src', url);
      // Make it invisible so it doesn't mess up layout but is part of DOM
      section.style.display = 'none';
      document.body.appendChild(section);

      // Call loadSection manually
      return window.SectionLoader.loadSection(section);
    }, TEST_FRAGMENT_URL);

    // Wait for content to appear
    const content = page.locator('#test-section-valid .test-content');
    await expect(content).toHaveText('Hello World');

    // Verify template was instantiated
    const extra = page.locator('#test-section-valid .extra');
    await expect(extra).toHaveText('Extra');

    // Verify attributes
    const section = page.locator('#test-section-valid');
    await expect(section).toHaveAttribute('data-state', 'loaded');
    await expect(section).not.toHaveAttribute('aria-busy', 'true');
  });

  test('should handle invalid section url with retry UI', async ({ page }) => {
    await page.evaluate((url) => {
      const section = document.createElement('section');
      section.id = 'test-section-invalid';
      section.setAttribute('data-section-src', url);
      section.setAttribute('aria-labelledby', 'test-label');

      const label = document.createElement('h2');
      label.id = 'test-label';
      label.textContent = 'Test Section';
      section.appendChild(label);

      document.body.appendChild(section);

      return window.SectionLoader.loadSection(section);
    }, INVALID_URL);

    const section = page.locator('#test-section-invalid');

    // Wait for error state
    // The retry logic (backoff) might take some time, but since we mock the 404 response immediately,
    // the fetch itself is instant. The retries (2 times) with delay (300, 600) will take ~1s.
    // We increase timeout just in case.
    await expect(section).toHaveAttribute('data-state', 'error', { timeout: 10000 });

    // Check for retry button
    const retryBtn = section.locator('.section-retry');
    await expect(retryBtn).toBeVisible();
    await expect(retryBtn).toHaveText('Erneut laden');
  });
});
