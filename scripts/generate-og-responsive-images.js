/*
Generates WebP responsive images and produces a metadata JSON mapping.
Usage: node scripts/generate-og-responsive-images.js
*/
const path = require('path');
const fs = require('fs/promises');
const sharp = require('sharp');

const SRC_DIR = path.resolve(__dirname, '../content/assets/img/og');
const OUT_DIR = SRC_DIR; // in-place
const SIZES = [400, 800, 1600, 2400];
// Keep only WebP as the single output format for responsive images
const FORMATS = [
  { ext: 'webp', options: { quality: 75 } },
];

(async () => {
  const files = await fs.readdir(SRC_DIR);
  const images = files.filter((f) => /og-.*\.(jpe?g|png)$/i.test(f));
  const meta = {};

  for (const f of images) {
    try {
      const base = path.parse(f).name; // e.g., og-threejs
      const p = path.join(SRC_DIR, f);
      const img = sharp(p);
      const info = await img.metadata();
      // generate sizes for each format
      meta[base] = meta[base] || { sources: {} };
      meta[base].original = `/content/assets/img/og/${f}`;
      meta[base].originalWidth = info.width || null;
      meta[base].originalHeight = info.height || null;

      for (const size of SIZES) {
        if (size > (info.width || 10000)) {
          // skip sizes larger than source
          continue;
        }
        for (const fmt of FORMATS) {
          const outName = `${base}-${size}.${fmt.ext}`;
          const outPath = path.join(OUT_DIR, outName);
          await img
            .resize(size)
            [fmt.ext](fmt.options)
            .toFile(outPath);

          meta[base].sources[fmt.ext] = meta[base].sources[fmt.ext] || [];
          meta[base].sources[fmt.ext].push({ url: `/content/assets/img/og/${outName}`, width: size });
        }
      }

      // No JPEG fallback generated anymore — WebP will be the single output format used site-wide.
      // Keep original file as canonical fallback if needed
      const webpWidths = (meta[base].sources['webp'] || []).map((s) => s.width);
      const chosen = webpWidths.length ? Math.max(...webpWidths) : (info.width || 1600);
      meta[base].fallback = `/content/assets/img/og/${base}-${chosen}.webp`;
      meta[base].fallbackWidth = Math.min(chosen, 2400);

      console.log('[generate] done', f);
    } catch (err) {
      console.error('[generate] failed', f, err);
    }
  }

  await fs.writeFile(path.join(SRC_DIR, 'og-images-meta.json'), JSON.stringify(meta, null, 2));
  console.log('Wrote og-images-meta.json');
})();
