/* global require, console, process, document, window */
/* eslint-disable no-console */
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.goto('http://localhost:8082/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.features-cards', { timeout: 5000 });
    const bbox1 = await page.locator('.features-cards').boundingBox();
    await page.screenshot({ path: 'tmp/screenshots/baseline.png', fullPage: true });

    await page.goto('http://localhost:8082/tmp/index-test.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.features-cards', { timeout: 5000 });
    const bbox2 = await page.locator('.features-cards').boundingBox();
    await page.screenshot({ path: 'tmp/screenshots/purged.png', fullPage: true });

    console.log('Baseline bbox:', bbox1);
    console.log('Purged bbox:  ', bbox2);

    const diffExists = fs.existsSync('tmp/screenshots/baseline.png') && fs.existsSync('tmp/screenshots/purged.png');
    console.log('Screenshots saved:', diffExists);
  } catch (e) {
    console.error('Visual test failed:', e);
    process.exitCode = 2;
  } finally {
    await browser.close();
  }
})();
