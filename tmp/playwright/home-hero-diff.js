const { chromium } = require('playwright');
const fs = require('fs');
const pixelmatch = require('pixelmatch').default || require('pixelmatch');
const { PNG } = require('pngjs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  try {
    fs.mkdirSync('tmp/screenshots/hero-diff', { recursive: true });

    const padding = 8; // include shadows

    // Baseline
    console.log('Capturing baseline hero');
    await page.goto('http://localhost:8082/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#hero', { timeout: 5000 });
    await page.waitForLoadState('networkidle');
    // Disable animations/transitions to reduce snapshot noise
    try {
      await page.addStyleTag({ content: '* { animation: none !important; transition: none !important; }' });
    } catch (e) { /* ignore */ }

    // Capture early (before dynamic visual effects kick in) to reduce non-deterministic diffs
    await page.waitForTimeout(50);

    const heroHandle = await page.$('#hero');
    const rect = await heroHandle.boundingBox();
    const clip = {
      x: Math.max(0, Math.floor(rect.x - padding)),
      y: Math.max(0, Math.floor(rect.y - padding)),
      width: Math.min(Math.ceil(rect.width + padding * 2), 1280),
      height: Math.min(Math.ceil(rect.height + padding * 2), 800)
    };
    const basePath = 'tmp/screenshots/hero-diff/home-hero-base.png';
    await page.screenshot({ path: basePath, clip });

    // Purged
    console.log('Capturing purged hero');
    await page.goto('http://localhost:8082/tmp/purged-site/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#hero', { timeout: 5000 });
    await page.waitForLoadState('networkidle');
    try {
      await page.addStyleTag({ content: '* { animation: none !important; transition: none !important; }' });
    } catch (e) { /* ignore */ }
    // Capture early (before dynamic visual effects kick in) to reduce non-deterministic diffs
    await page.waitForTimeout(50);
    const heroHandleP = await page.$('#hero');
    const rectP = await heroHandleP.boundingBox();
    const clipP = {
      x: Math.max(0, Math.floor(rectP.x - padding)),
      y: Math.max(0, Math.floor(rectP.y - padding)),
      width: Math.min(Math.ceil(rectP.width + padding * 2), 1280),
      height: Math.min(Math.ceil(rectP.height + padding * 2), 800)
    };
    const purgedPath = 'tmp/screenshots/hero-diff/home-hero-purged.png';
    await page.screenshot({ path: purgedPath, clip: clipP });

    // Compare by cropping both screenshots to the intersection min(width,height) to avoid layout shift issues
    const img1 = PNG.sync.read(fs.readFileSync(basePath));
    const img2 = PNG.sync.read(fs.readFileSync(purgedPath));
    const width = Math.min(img1.width, img2.width);
    const height = Math.min(img1.height, img2.height);

    function cropTo(img, w, h) {
      if (img.width === w && img.height === h) return img;
      const out = new PNG({ width: w, height: h });
      for (let y = 0; y < h; y++) {
        const srcStart = (y * img.width) * 4;
        const srcEnd = srcStart + (w * 4);
        const dstStart = (y * w) * 4;
        img.data.copy(out.data, dstStart, srcStart, srcEnd);
      }
      return out;
    }

    const a = cropTo(img1, width, height);
    const b = cropTo(img2, width, height);
    const diff = new PNG({ width, height });
    const mismatched = pixelmatch(a.data, b.data, diff.data, width, height, { threshold: 0.12 });
    const diffPath = 'tmp/screenshots/hero-diff/home-hero-diff.png';
    fs.writeFileSync(diffPath, PNG.sync.write(diff));
    console.log(`Hero diff created: mismatched pixels = ${mismatched}`);
    const total = width * height;
    console.log(`Image size: ${width}x${height} (${total} px). Diff ratio: ${(mismatched / total * 100).toFixed(4)}%`);
    console.log('Artifacts saved to tmp/screenshots/hero-diff/');

  } catch (e) {
    console.error('Hero diff run failed:', e);
    process.exitCode = 2;
  } finally {
    await browser.close();
  }
})();