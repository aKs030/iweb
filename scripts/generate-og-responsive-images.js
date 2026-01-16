/*
Generates WebP responsive images and produces a metadata JSON mapping.
Usage: node scripts/generate-og-responsive-images.js
*/
const path = require('path');
const fs = require('fs/promises');
const sharp = require('sharp');

const SRC_DIR = path.resolve(__dirname, '../content/assets/img/og');
const OUT_DIR = SRC_DIR; // in-place
// Target a single canonical OG width (no upscaling): 1200px wide (approx. 1200×630 target aspect)
const SIZES = [1200];
// Only WebP to minimize footprint and prefer modern format
const FORMATS = [{ ext: 'webp', options: { quality: 75 }, method: 'webp' }];

// Note: The script will accept WebP/JPG/PNG inputs but will only output a single webp fallback per image (no JPEGs).

(async () => {
  const files = await fs.readdir(SRC_DIR);
  // Accept source files in JPG, PNG and WebP so we can generate both webp and jpeg outputs
  const images = files.filter((f) => /og-.*\.(jpe?g|png|webp)$/i.test(f));
  const meta = {};

  // normalize base names (strip trailing numeric suffixes like -800)
  const canonicalBase = (name) => name.replace(/(-\d+)+$/, '');

  for (const f of images) {
    try {
      const rawBase = path.parse(f).name; // e.g., og-threejs or og-home-800
      const base = canonicalBase(rawBase); // normalized base like 'og-home'
      const p = path.join(SRC_DIR, f);
      const img = sharp(p);
      const info = await img.metadata();

      // initialize canonical meta entry if needed
      meta[base] = meta[base] || { sources: {} };

      // prefer the largest source as representative original
      if (
        !meta[base].originalWidth ||
        (info.width || 0) > (meta[base].originalWidth || 0)
      ) {
        meta[base].original = `/content/assets/img/og/${f}`;
        meta[base].originalWidth = info.width || null;
        meta[base].originalHeight = info.height || null;
      }

      // produce a single webp file at target width (no upscaling)
      const target = Math.min(SIZES[0], info.width || SIZES[0]);
      const outName = `${base}-${target}.webp`;
      const outPath = path.join(OUT_DIR, outName);

      const pipeline =
        info.width && info.width >= target ? img.resize(target) : img.clone();
      await pipeline
        .webp({ quality: FORMATS[0].options.quality })
        .toFile(outPath);

      // set canonical sources/fallback
      meta[base].sources['webp'] = [
        { url: `/content/assets/img/og/${outName}`, width: target },
      ];
      meta[base].fallback = `/content/assets/img/og/${outName}`;
      meta[base].fallbackWidth = target;

      console.log('[generate] done', f, '->', outName);
    } catch (err) {
      console.error('[generate] failed', f, err);
    }
  }

  await fs.writeFile(
    path.join(SRC_DIR, 'og-images-meta.json'),
    JSON.stringify(meta, null, 2),
  );
  console.log('Wrote og-images-meta.json');

  // Cleanup: remove generated variants that are not referenced in meta (reduce repo size)
  try {
    const keep = new Set();
    for (const k of Object.keys(meta)) {
      const m = meta[k];
      if (!m) continue;
      if (m.fallback) keep.add(path.basename(m.fallback));
      for (const fmt of Object.keys(m.sources || {})) {
        for (const s of m.sources[fmt]) keep.add(path.basename(s.url));
      }
    }

    const allFiles = await fs.readdir(SRC_DIR);
    const deletable = allFiles.filter((f) => {
      // target only og-*.{webp,jpg,jpeg} with a size suffix (e.g. og-home-800.webp)
      if (!/^og-.*-\d+\.(webp|jpg|jpeg)$/i.test(f)) return false;
      if (keep.has(f)) return false;
      // keep meta file and originals
      if (f === 'og-images-meta.json') return false;
      return true;
    });

    for (const d of deletable) {
      try {
        await fs.unlink(path.join(SRC_DIR, d));
        console.log('[cleanup] removed', d);
      } catch (e) {
        console.warn('[cleanup] failed', d, e.message);
      }
    }
  } catch (e) {
    console.warn('[cleanup] failed', e.message);
  }
})();
