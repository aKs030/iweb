import { ROUTES } from '../content/config/routes-config.js';
import { escapeXml, normalizePath, resolveOrigin } from './api/_xml-utils.js';
import { respondWithSnapshotOr503 } from './api/_sitemap-snapshot.js';
import { dedupeBy, saveAndRespondSitemapXml } from './api/_sitemap-response.js';
import {
  buildBlogPath,
  buildProjectAppPath,
  loadBlogPosts,
  loadProjectApps,
} from './api/_sitemap-data.js';

const CACHE_CONTROL = 'public, max-age=3600, stale-while-revalidate=86400';
const SNAPSHOT_NAME = 'sitemap.xml';

const ROUTE_META = {
  '/': { priority: 1.0, changefreq: 'weekly' },
  '/gallery/': { priority: 0.85, changefreq: 'weekly' },
  '/videos/': { priority: 0.8, changefreq: 'weekly' },
  '/projekte/': { priority: 0.75, changefreq: 'monthly' },
  '/blog/': { priority: 0.75, changefreq: 'weekly' },
  '/about/': { priority: 0.6, changefreq: 'monthly' },
  '/contact/': { priority: 0.55, changefreq: 'monthly' },
  '/ai-info/': { priority: 0.65, changefreq: 'weekly' },
};

const NOINDEX_PATHS = new Set(['/datenschutz/', '/impressum/']);
const EXTRA_INDEXABLE_PATHS = ['/ai-info/'];

function buildStaticEntries(today) {
  const staticPaths = [
    '/',
    ...Object.keys(ROUTES)
      .filter((path) => path.startsWith('/'))
      .map(normalizePath)
      .filter((path) => !NOINDEX_PATHS.has(path)),
    ...EXTRA_INDEXABLE_PATHS,
  ];

  const uniquePaths = [...new Set(staticPaths)];
  return uniquePaths.map((path) => {
    const meta = ROUTE_META[path] || { priority: 0.5, changefreq: 'monthly' };
    return {
      path,
      lastmod: today,
      changefreq: meta.changefreq,
      priority: meta.priority,
    };
  });
}

function buildProjectAppEntries(apps, today) {
  return apps
    .filter((app) => app && typeof app.name === 'string' && app.name)
    .map((app) => ({
      path: buildProjectAppPath(app.name),
      lastmod: app.lastmod || today,
      changefreq: 'monthly',
      priority: 0.62,
    }));
}

function buildBlogEntries(posts, today) {
  return posts
    .filter((post) => post && typeof post.id === 'string' && post.id)
    .map((post) => ({
      path: buildBlogPath(post.id),
      lastmod: post.lastmod || today,
      changefreq: 'monthly',
      priority: 0.64,
    }));
}

function toXmlEntry(origin, entry) {
  return `  <url>
    <loc>${escapeXml(`${origin}${entry.path}`)}</loc>
    <lastmod>${entry.lastmod}</lastmod>
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority.toFixed(2)}</priority>
  </url>`;
}

export async function onRequest(context) {
  try {
    const origin = resolveOrigin(context.request.url);
    const today = new Date().toISOString().split('T')[0];

    const [staticEntries, blogPosts, projectApps] = await Promise.all([
      Promise.resolve(buildStaticEntries(today)),
      loadBlogPosts(context),
      loadProjectApps(context),
    ]);

    const blogEntries = buildBlogEntries(blogPosts, today);
    const appEntries = buildProjectAppEntries(projectApps, today);
    const allEntries = [...staticEntries, ...blogEntries, ...appEntries];
    const dedupedEntries = dedupeBy(allEntries, (entry) => entry.path);

    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      ...dedupedEntries.map((entry) => toXmlEntry(origin, entry)),
      '</urlset>',
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
