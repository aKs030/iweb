// Normalize og-images-meta.json to keep only webp sources and choose largest webp as fallback
const fs = require('fs');
const path = require('path');
const META = path.resolve(__dirname, '../content/assets/img/og/og-images-meta.json');
(async () => {
  const raw = fs.readFileSync(META, 'utf8');
  const data = JSON.parse(raw);
  for (const k of Object.keys(data)) {
    const entry = data[k];
    // Remove avif if present
    if (entry.sources && entry.sources.avif) delete entry.sources.avif;
    // If webp present, pick largest width as fallback
    if (entry.sources && entry.sources.webp && entry.sources.webp.length) {
      const sorted = entry.sources.webp.slice().sort((a,b) => a.width - b.width);
      entry.fallback = sorted[sorted.length-1].url;
      entry.fallbackWidth = sorted[sorted.length-1].width;
      // Keep only webp in sources (already)
    } else {
      // if no webp available, fall back to original
      entry.fallback = entry.fallback || entry.original;
      entry.fallbackWidth = entry.fallbackWidth || entry.originalWidth || null;
    }
    // remove any other format keys except webp
    Object.keys(entry.sources || {}).forEach(fmt => { if (fmt !== 'webp') delete entry.sources[fmt]; });
  }
  fs.writeFileSync(META, JSON.stringify(data, null, 2));
  console.log('Normalized og-images-meta.json (webp only)');
})();