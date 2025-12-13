
import { test, expect } from '@playwright/test';

test.use({
  baseURL: 'http://localhost:8081',
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  contextOptions: {
    permissions: [],
  }
});

test('verify virtual camera alignment and transform reset', async ({ page, context }) => {
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });

  await page.goto('/?debug=true');
  await page.waitForSelector('#threeEarthContainer', { state: 'visible' });

  await page.waitForFunction(() => {
    const sys = window.threeEarthSystem;
    return sys && sys.EarthSystemAPI && sys.EarthSystemAPI.starManager;
  }, null, { timeout: 15000 });

  const result = await page.evaluate(async () => {
    const api = window.threeEarthSystem.EarthSystemAPI;
    const sm = api.starManager;

    // 1. Simulate Parallax (dirty state)
    if (sm.starField) {
        sm.starField.rotation.y = 1.5;
        sm.starField.position.z = 10;
        sm.starField.updateMatrixWorld(true);
    }

    // 2. Trigger "Features" mode (which calls animateStarsToCards)
    sm.animateStarsToCards();

    // 3. Verify Virtual Camera Update
    if (!sm.virtualCamera) return { error: 'VirtualCamera not initialized' };
    const cam = sm.virtualCamera;
    const camPos = { x: cam.position.x, y: cam.position.y, z: cam.position.z };

    // 4. Verify Transform Reset
    const sf = sm.starField;
    const sfRot = { x: sf.rotation.x, y: sf.rotation.y, z: sf.rotation.z };
    const sfPos = { x: sf.position.x, y: sf.position.y, z: sf.position.z };

    return {
      cameraPosition: camPos,
      starFieldRotation: sfRot,
      starFieldPosition: sfPos,
      areStarsFormingCards: sm.areStarsFormingCards
    };
  });

  if (result.error) throw new Error(result.error);

  console.log('System State:', result);

  // Assertions
  expect(result.cameraPosition.x).toBeCloseTo(7.0, 1);
  expect(result.cameraPosition.y).toBeCloseTo(5.5, 1);
  expect(result.cameraPosition.z).toBeCloseTo(7.5, 1);

  // CRITICAL: Verify StarField was reset to identity
  expect(result.starFieldRotation.y).toBe(0);
  expect(result.starFieldPosition.z).toBe(0);
  expect(result.areStarsFormingCards).toBe(true);
});
