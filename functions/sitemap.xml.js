import { ROUTES } from '../content/config/routes-config.js';
import { escapeXml, normalizePath, resolveOrigin } from './api/_xml-utils.js';
import {
  buildSitemapHeaders,
  respondWithSnapshotOr503,
  saveSitemapSnapshot,
} from './api/_sitemap-snapshot.js';
import {
  BLOG_INDEX_PATH,
  PROJECT_APPS_PATH,
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
  '/impressum/': { priority: 0.2, changefreq: 'yearly' },
  '/datenschutz/': { priority: 0.2, changefreq: 'yearly' },
  '/ai-info': { priority: 0.4, changefreq: 'monthly' },
  '/llms.txt': { priority: 0.5, changefreq: 'monthly' },
  '/llms-full.txt': { priority: 0.5, changefreq: 'monthly' },
  '/ai-index.json': { priority: 0.4, changefreq: 'monthly' },
  '/person.jsonld': { priority: 0.6, changefreq: 'monthly' },
  '/bio.md': { priority: 0.5, changefreq: 'monthly' },
  '/pages/projekte/apps-config.json': { priority: 0.44, changefreq: 'weekly' },
  '/pages/blog/posts/index.json': { priority: 0.4, changefreq: 'weekly' },
  '/.well-known/openapi.json': { priority: 0.38, changefreq: 'monthly' },
  '/.well-known/ai-plugin.json': { priority: 0.36, changefreq: 'monthly' },
  '/robots.txt': { priority: 0.3, changefreq: 'monthly' },
};

const DISCOVERY_PATHS = [
  '/ai-info',
  '/llms.txt',
  '/llms-full.txt',
  '/ai-index.json',
  '/person.jsonld',
  '/bio.md',
  PROJECT_APPS_PATH,
  BLOG_INDEX_PATH,
  '/.well-known/openapi.json',
  '/.well-known/ai-plugin.json',
  '/robots.txt',
];

function buildStaticEntries(today) {
  const staticPaths = [
    '/',
    ...Object.keys(ROUTES)
      .filter((path) => path.startsWith('/'))
      .map(normalizePath),
    // AI discovery + index resources
    ...DISCOVERY_PATHS,
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

    const dedupedEntries = [];
    const seen = new Set();
    for (const entry of allEntries) {
      if (seen.has(entry.path)) continue;
      seen.add(entry.path);
      dedupedEntries.push(entry);
    }

    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      ...dedupedEntries.map((entry) => toXmlEntry(origin, entry)),
      '</urlset>',
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
