import { test, expect } from '@playwright/test';

test.describe('Robot Companion Component', () => {
  test.beforeEach(async ({ page }) => {
    // Go to homepage
    await page.goto('/');
    // Wait for robot to be injected
    await page.waitForSelector('#robot-companion-container');
  });

  test('Robot avatar should be an accessible button', async ({ page }) => {
    const avatar = page.locator('.robot-avatar');
    // This expects the element to be a <button> or have role="button"
    // Currently it is a div, so this might fail if we strict check tag name
    // or accessibility role.
    // Let's check tag name specifically as that's the robust fix.
    const tagName = await avatar.evaluate(el => el.tagName.toLowerCase());
    expect(tagName).toBe('button');
  });

  test('Robot should respect prefers-reduced-motion', async ({ page }) => {
    // Enable reduced motion
    await page.emulateMedia({ reducedMotion: 'reduce' });

    // Reload to ensure logic picks up the media query on init if needed
    await page.reload();
    await page.waitForSelector('#robot-companion-container');

    const container = page.locator('#robot-companion-container');

    // Get initial transform
    const initialTransform = await container.evaluate(el => el.style.transform);

    // Wait a bit (animation loop would normally update it)
    await page.waitForTimeout(500);

    // Get new transform
    const newTransform = await container.evaluate(el => el.style.transform);

    // If reduced motion is active, the robot should not be patrolling (changing transform)
    // The current implementation moves it constantly.
    expect(newTransform).toBe(initialTransform);
  });
});
