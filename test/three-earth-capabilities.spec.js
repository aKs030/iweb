const { test, expect } = require('@playwright/test');

test('three-earth detectDeviceCapabilities & optimised config', async ({ page }) => {
  page.on('console', (msg) => console.log('PAGE_CONSOLE:', msg.type(), msg.text()));
  await page.goto('/');

  const res = await page.evaluate(async () => {
    try {
      const mod = await import('/content/particles/three-earth-system.js');
      const caps = await mod.detectDeviceCapabilities();
      const config = await mod.getOptimizedConfig(caps);
      return { ok: true, caps: Object.keys(caps || {}), configKeys: Object.keys(config || {}) };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });

  console.log('EVAL RESULT:', res);
  expect(res.ok).toBe(true);
  expect(res.caps).toEqual(expect.arrayContaining(['isMobile', 'isLowEnd', 'recommendedQuality']));
  expect(res.configKeys.length).toBeGreaterThan(0);
});
