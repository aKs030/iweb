/* global require, console, process, document, window */
/* eslint-disable no-console */
const { chromium } = require('playwright');
const fs = require('fs');
const pixelmatch = require('pixelmatch').default || require('pixelmatch');
const { PNG } = require('pngjs');

const pages = [
  { path: '/', name: 'home' },
  { path: '/about/', name: 'about' },
  { path: '/projekte/', name: 'projekte' },
  { path: '/gallery/', name: 'gallery' },
  { path: '/videos/', name: 'videos' },
  { path: '/blog/', name: 'blog' }
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    fs.mkdirSync('tmp/screenshots/aggressive', { recursive: true });

    for (const p of pages) {
      const urlBase = `http://localhost:8082${p.path}`;
      console.log('Checking baseline', urlBase);
      await page.goto(urlBase, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle');
      const baseShot = `tmp/screenshots/aggressive/${p.name}-base.png`;
      await page.screenshot({ path: baseShot, fullPage: true });

      // Purged site version
      const purgedUrl = `http://localhost:8082/tmp/purged-site${p.path}`;
      console.log('Checking purged', purgedUrl);
      await page.goto(purgedUrl, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle');
      const purgedShot = `tmp/screenshots/aggressive/${p.name}-purged.png`;
      await page.screenshot({ path: purgedShot, fullPage: true });

      // Compare images
      const img1 = PNG.sync.read(fs.readFileSync(baseShot));
      const img2 = PNG.sync.read(fs.readFileSync(purgedShot));
      const { width, height } = img1;
      const diff = new PNG({ width, height });
      const mismatched = pixelmatch(img1.data, img2.data, diff.data, width, height, { threshold: 0.15 });
      const diffPath = `tmp/screenshots/aggressive/${p.name}-diff.png`;
      fs.writeFileSync(diffPath, PNG.sync.write(diff));
      console.log(`${p.name}: mismatched pixels = ${mismatched}`);
    }

    console.log('Visual aggressive run complete. Screenshots saved to tmp/screenshots/aggressive');
  } catch (e) {
    console.error('Visual aggressive test failed:', e);
    process.exitCode = 2;
  } finally {
    await browser.close();
  }
})();