import { escapeXml, resolveOrigin } from './api/_xml-utils.js';
import { respondWithSnapshotOr503 } from './api/_sitemap-snapshot.js';
import { saveAndRespondSitemapXml } from './api/_sitemap-response.js';

const SITEMAP_PATHS = [
  '/sitemap.xml',
  '/sitemap-images.xml',
  '/sitemap-videos.xml',
];
const CACHE_CONTROL = 'public, max-age=3600, stale-while-revalidate=86400';
const SNAPSHOT_NAME = 'sitemap-index.xml';

export async function onRequest(context) {
  try {
    const origin = resolveOrigin(context.request.url);
    const today = new Date().toISOString().split('T')[0];

    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      ...SITEMAP_PATHS.map(
        (path) => `  <sitemap>
    <loc>${escapeXml(`${origin}${path}`)}</loc>
    <lastmod>${today}</lastmod>
  </sitemap>`,
      ),
      '</sitemapindex>',
    ].join('\n');

    return saveAndRespondSitemapXml({
      env: context.env,
      name: SNAPSHOT_NAME,
      xml,
      cacheControl: CACHE_CONTROL,
    });
  } catch {
    return respondWithSnapshotOr503({
      env: context.env,
      name: SNAPSHOT_NAME,
      cacheControl: CACHE_CONTROL,
    });
  }
}
