
import { test, expect } from '@playwright/test';

test('ShootingStarManager should reuse meshes (object pooling)', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'userAgent', {
      get: () => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    });
    Object.defineProperty(navigator, 'webdriver', {
      get: () => false,
    });
  });

  await page.goto('/');

  await page.waitForSelector('#threeEarthContainer');
  await page.evaluate(() => {
    const container = document.getElementById('threeEarthContainer');
    if (container) container.scrollIntoView();
  });
  await page.waitForTimeout(3000);

  const result = await page.evaluate(async () => {
    try {
      const earthModule = await import('/content/components/particles/three-earth-system.js');
      const api = earthModule.EarthSystemAPI;

      if (!api || !api.shootingStarManager) {
        return { error: 'ShootingStarManager not accessible via API' };
      }

      const manager = api.shootingStarManager;
      manager.disabled = false; // Ensure enabled

      // Clear existing
      manager.activeStars.forEach(s => manager.scene.remove(s.mesh));
      manager.activeStars = [];

      // 1. Create a star
      manager.createShootingStar();
      if (manager.activeStars.length !== 1) return { error: 'Failed to create star 1' };

      const star1 = manager.activeStars[0];
      const uuid1 = star1.mesh.uuid;

      // 2. Kill the star
      star1.lifetime = 10;
      star1.age = 20; // > lifetime

      manager.update();

      if (manager.activeStars.length !== 0) {
        return { error: `Star did not die. Age: ${star1.age}, Lifetime: ${star1.lifetime}` };
      }

      // 3. Create another star
      manager.createShootingStar();
      if (manager.activeStars.length !== 1) return { error: 'Failed to create star 2' };

      const star2 = manager.activeStars[0];
      const uuid2 = star2.mesh.uuid;

      return {
        uuid1,
        uuid2,
        isSame: uuid1 === uuid2
      };

    } catch (e) {
      return { error: e.toString() };
    }
  });

  if (result.error) throw new Error(result.error);

  // EXPECT FAILURE BEFORE FIX:
  // Since we create a NEW mesh each time, uuid1 !== uuid2.
  // So result.isSame should be FALSE.
  // The test asserts it to be TRUE (expecting the fix).
  expect(result.isSame).toBe(true);
});
