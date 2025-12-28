/* global require, console, process, document, window */
/* eslint-disable no-console */
const { test, expect } = require('@playwright/test');

test('baseline features visible', async ({ page }) => {
  await page.goto('http://localhost:8082/');
  await page.waitForSelector('.features-cards', { timeout: 5000 });
  const bbox = await page.locator('.features-cards').boundingBox();
  expect(bbox).not.toBeNull();
  expect(bbox.width).toBeGreaterThan(0);
  await page.screenshot({ path: 'tmp/screenshots/baseline.png', fullPage: true });
});

test('purged features visible', async ({ page }) => {
  await page.goto('http://localhost:8082/tmp/index-test.html');
  await page.waitForSelector('.features-cards', { timeout: 5000 });
  const bbox = await page.locator('.features-cards').boundingBox();
  expect(bbox).not.toBeNull();
  expect(bbox.width).toBeGreaterThan(0);
  await page.screenshot({ path: 'tmp/screenshots/purged.png', fullPage: true });
});
