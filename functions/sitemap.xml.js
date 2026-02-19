import { ROUTES } from '../content/config/routes-config.js';

const ROUTE_META = {
  '/': { priority: 1.0, changefreq: 'weekly' },
  '/gallery/': { priority: 0.85, changefreq: 'weekly' },
  '/videos/': { priority: 0.8, changefreq: 'weekly' },
  '/projekte/': { priority: 0.75, changefreq: 'monthly' },
  '/blog/': { priority: 0.75, changefreq: 'weekly' },
  '/about/': { priority: 0.6, changefreq: 'monthly' },
  '/contact/': { priority: 0.6, changefreq: 'monthly' },
  '/impressum/': { priority: 0.2, changefreq: 'yearly' },
  '/datenschutz/': { priority: 0.2, changefreq: 'yearly' },
};

const BLOG_INDEX_PATH = '/pages/blog/posts/index.json';

function normalizePath(path) {
  if (!path) return '/';
  if (path === '/') return '/';

  let normalized = String(path).trim();
  if (!normalized.startsWith('/')) normalized = '/' + normalized;
  normalized = normalized.replace(/\/index\.html?$/i, '/');
  if (!normalized.endsWith('/')) normalized += '/';

  return normalized;
}

function toISODate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().split('T')[0];
}

function escapeXml(value) {
  return String(value ?? '').replace(/[<>&'"]/g, (char) => {
    switch (char) {
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '&':
        return '&amp;';
      case "'":
        return '&apos;';
      case '"':
        return '&quot;';
      default:
        return char;
    }
  });
}

function resolveOrigin(requestUrl) {
  const url = new URL(requestUrl);
  if (url.hostname === 'abdulkerimsesli.de') {
    url.hostname = 'www.abdulkerimsesli.de';
  }
  return url.origin;
}

async function loadBlogPosts(context) {
  if (!context.env?.ASSETS) {
    return [];
  }

  const indexUrl = new URL(BLOG_INDEX_PATH, context.request.url);
  const response = await context.env.ASSETS.fetch(indexUrl);
  if (!response.ok) {
    return [];
  }

  const posts = await response.json();
  return Array.isArray(posts) ? posts : [];
}

function buildStaticEntries(today) {
  const staticPaths = [
    '/',
    ...Object.keys(ROUTES)
      .filter((path) => path.startsWith('/'))
      .map(normalizePath),
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

function buildBlogEntries(posts, today) {
  return posts
    .filter((post) => post && typeof post.id === 'string' && post.id.trim())
    .map((post) => ({
      path: `/blog/${encodeURIComponent(post.id.trim())}/`,
      lastmod: toISODate(post.date) || today,
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
  const origin = resolveOrigin(context.request.url);
  const today = new Date().toISOString().split('T')[0];

  const [staticEntries, blogPosts] = await Promise.all([
    Promise.resolve(buildStaticEntries(today)),
    loadBlogPosts(context),
  ]);

  const blogEntries = buildBlogEntries(blogPosts, today);
  const allEntries = [...staticEntries, ...blogEntries];

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

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  });
}
