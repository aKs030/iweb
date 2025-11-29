
import { test, expect } from '@playwright/test';

test('trapFocus should skip hidden inputs and focus the first visible focusable element', async ({ page }) => {
  await page.goto('/');

  // Inject a test container with a hidden input and a visible button
  await page.setContent(`
    <html>
      <body>
        <div id="trap-container">
          <input type="hidden" id="hidden-input" value="secret">
          <button id="visible-button">Click Me</button>
        </div>
      </body>
    </html>
  `);

  // Import accessibility manager and trigger trapFocus
  await page.evaluate(async () => {
    // We need to import the module to use it.
    // Since we overwrote the content, we need to load the script.
    // However, it's easier to just paste the minimal logic or use the existing logic if we didn't overwrite everything.
    // But page.setContent overwrites everything.
    // Let's rely on the fact that the project structure allows importing.

    // We need to re-import the module because the page context is new.
    const { AccessibilityManager } = await import('/content/webentwicklung/accessibility-manager.js');
    const a11y = new AccessibilityManager();

    const container = document.getElementById('trap-container');
    a11y.trapFocus(container);
  });

  // Check which element is focused
  const activeId = await page.evaluate(() => document.activeElement.id);

  expect(activeId).toBe('visible-button');
});
