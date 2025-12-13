
import { test, expect } from '@playwright/test';

test.use({
  baseURL: 'http://localhost:8081',
  // Mask headless nature to avoid application entering "Test Mode" which disables WebGL
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  contextOptions: {
    permissions: [],
  }
});

test('verify virtual camera alignment logic', async ({ page, context }) => {
  // Override navigator.webdriver to false
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => false,
    });
  });

  // 1. Go to the page
  await page.goto('/?debug=true'); // Enable debug to ensure window.threeEarthSystem is exposed

  // 2. Wait for system to load
  await page.waitForSelector('#threeEarthContainer', { state: 'visible' });

  // Wait for starManager to be initialized
  await page.waitForFunction(() => {
    const sys = window.threeEarthSystem;
    return sys && sys.EarthSystemAPI && sys.EarthSystemAPI.starManager;
  }, null, { timeout: 15000 });

  // 3. Evaluate the star manager logic
  const result = await page.evaluate(async () => {
    const api = window.threeEarthSystem.EarthSystemAPI;
    const sm = api.starManager;

    // Manually trigger the virtual camera update
    if (!sm.virtualCamera) return { error: 'VirtualCamera not initialized' };

    sm.updateVirtualCamera();

    const cam = sm.virtualCamera;
    const pos = { x: cam.position.x, y: cam.position.y, z: cam.position.z };
    const rot = { x: cam.rotation.x, y: cam.rotation.y, z: cam.rotation.z };

    return {
      position: pos,
      rotation: rot,
      hasStarField: !!sm.starField,
      aspect: cam.aspect
    };
  });

  if (result.error) {
    throw new Error(result.error);
  }

  console.log('Virtual Camera State:', result);

  // Assertions based on "features" preset logic
  // x = 7.0, y = 5.5, z = 7.5
  expect(result.position.x).toBeCloseTo(7.0, 1);
  expect(result.position.y).toBeCloseTo(5.5, 1);
  expect(result.position.z).toBeCloseTo(7.5, 1);

  // Verify star field exists
  expect(result.hasStarField).toBe(true);
});
