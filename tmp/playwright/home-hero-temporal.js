const { chromium } = require('playwright');
const fs = require('fs');
const pixelmatch = require('pixelmatch').default || require('pixelmatch');
const { PNG } = require('pngjs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  try {
    fs.mkdirSync('tmp/screenshots/hero-temporal', { recursive: true });

    const padding = 8;
    const times = [0, 250, 500, 1000, 2000, 4000];

    for (const t of times) {
      console.log(`Capturing baseline at ${t}ms`);
      await page.goto('http://localhost:8082/', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#hero', { timeout: 5000 });
      try { await page.addStyleTag({ content: '* { animation: none !important; transition: none !important; }' }); } catch {
        /* ignore */
      }
      await page.waitForTimeout(t);
      const hero = await page.$('#hero');
      const rect = await hero.boundingBox();
      const clip = { x: Math.max(0, Math.floor(rect.x - padding)), y: Math.max(0, Math.floor(rect.y - padding)), width: Math.min(Math.ceil(rect.width + padding * 2), 1280), height: Math.min(Math.ceil(rect.height + padding * 2), 800) };
      const basePath = `tmp/screenshots/hero-temporal/home-base-${t}.png`;
      await page.screenshot({ path: basePath, clip });

      console.log(`Capturing purged at ${t}ms`);
      await page.goto('http://localhost:8082/tmp/purged-site/', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#hero', { timeout: 5000 });
      try { await page.addStyleTag({ content: '* { animation: none !important; transition: none !important; }' }); } catch { /* ignore */ }
      await page.waitForTimeout(t);
      const heroP = await page.$('#hero');
      const rectP = await heroP.boundingBox();
      const purgedPath = `tmp/screenshots/hero-temporal/home-purged-${t}.png`;
      await page.screenshot({ path: purgedPath, clip });

      // Compare
      const img1 = PNG.sync.read(fs.readFileSync(basePath));
      const img2 = PNG.sync.read(fs.readFileSync(purgedPath));
      const width = Math.min(img1.width, img2.width);
      const height = Math.min(img1.height, img2.height);
      const a = new PNG({ width, height });
      const b = new PNG({ width, height });
      for (let y = 0; y < height; y++) {
        const srcStart1 = (y * img1.width) * 4;
        img1.data.copy(a.data, (y * width) * 4, srcStart1, srcStart1 + (width * 4));
        const srcStart2 = (y * img2.width) * 4;
        img2.data.copy(b.data, (y * width) * 4, srcStart2, srcStart2 + (width * 4));
      }
      const diff = new PNG({ width, height });
      const mismatched = pixelmatch(a.data, b.data, diff.data, width, height, { threshold: 0.12 });
      fs.writeFileSync(`tmp/screenshots/hero-temporal/diff-${t}.png`, PNG.sync.write(diff));
      console.log(`t=${t}ms -> mismatched=${mismatched} ratio=${(mismatched/(width*height)*100).toFixed(4)}%`);
    }

    console.log('Temporal capture complete. Artifacts in tmp/screenshots/hero-temporal');
  } catch (e) {
    console.error('Temporal capture failed:', e);
    process.exitCode = 2;
  } finally {
    await browser.close();
  }
})();