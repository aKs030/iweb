import {test, expect} from '@playwright/test';

test.describe('SectionTracker Global Exposure', () => {
  test('should NOT expose sectionTracker globally by default', async ({page}) => {
    await page.goto('/');
    const isDefined = await page.evaluate(() => typeof window.sectionTracker !== 'undefined');
    expect(isDefined).toBe(false);
  });

  test('should expose sectionTracker globally when debug mode is enabled', async ({page}) => {
    await page.goto('/?debug');
    const isDefined = await page.evaluate(() => typeof window.sectionTracker !== 'undefined');
    expect(isDefined).toBe(true);
  });
});
