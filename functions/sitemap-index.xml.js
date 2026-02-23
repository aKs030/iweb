import { escapeXml, resolveOrigin } from './api/_xml-utils.js';
import {
  buildSitemapHeaders,
  respondWithSnapshotOr503,
  saveSitemapSnapshot,
} from './api/_sitemap-snapshot.js';

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

    await saveSitemapSnapshot(context.env, SNAPSHOT_NAME, xml);

    return new Response(xml, {
      headers: buildSitemapHeaders(CACHE_CONTROL),
    });
  } catch {
    return respondWithSnapshotOr503({
      env: context.env,
      name: SNAPSHOT_NAME,
      cacheControl: CACHE_CONTROL,
    });
  }
}
