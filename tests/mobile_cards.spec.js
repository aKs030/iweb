const { test, expect } = require('@playwright/test');

test('mobile cards layout', async ({ page }) => {
  // 1. Set Mobile Viewport (iPhone 12/13/14 approximation)
  await page.setViewportSize({ width: 390, height: 844 });

  // 2. Force Three.js (bypass headless check)
  await page.addInitScript(() => {
    window.__FORCE_THREE_EARTH = true;
    // Mock user agent to ensure we don't trigger "HeadlessChrome" fallbacks if checked elsewhere
    Object.defineProperty(navigator, 'userAgent', {
        get: () => 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1'
    });
  });

  // 3. Load Page
  await page.goto('/');

  // 4. Wait for Loading Screen to vanish
  await expect(page.locator('#loadingScreen')).toHaveClass(/hide/, { timeout: 10000 });
  await expect(page.locator('#loadingScreen')).toBeHidden();

  // 5. Scroll to Features Section
  // We use the ID usually associated with the section. Based on config, it's often section 2 (index 1) or 'features'.
  // Let's find the element with class .features-cards or ID #features.
  const featuresSection = page.locator('#features');
  await featuresSection.scrollIntoViewIfNeeded();

  // 6. Wait for Cards to Initialize (CardManager creates canvas textures)
  // The canvas is in #threeEarthContainer canvas
  await expect(page.locator('#threeEarthContainer canvas')).toBeVisible();

  // Wait a bit for entrance animations (CardManager has entranceDelay)
  // The config says entranceDelay: index * 80ms, plus fade in.
  await page.waitForTimeout(2000);

  // 7. Take Screenshot
  await page.screenshot({ path: 'mobile_cards_verification.png' });
});
