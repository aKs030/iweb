import { ROUTES } from '../content/config/routes-config.js';
import {
  escapeXml,
  loadJsonAsset,
  normalizePath,
  resolveOrigin,
  toISODate,
} from './api/_xml-utils.js';
import {
  fetchPlaylistItemsPage,
  fetchUploadsPlaylistId,
  toYoutubeDate,
} from './api/_youtube-utils.js';

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
  '/ai-info.html': { priority: 0.4, changefreq: 'monthly' },
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

const BLOG_INDEX_PATH = '/pages/blog/posts/index.json';
const PROJECT_APPS_PATH = '/pages/projekte/apps-config.json';
const MAX_YOUTUBE_RESULTS = 200;
const DISCOVERY_PATHS = [
  '/ai-info.html',
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

async function loadVideoEntries(env, today) {
  const channelId = env?.YOUTUBE_CHANNEL_ID;
  const apiKey = env?.YOUTUBE_API_KEY;
  if (!channelId || !apiKey) return [];

  const uploadsPlaylistId = await fetchUploadsPlaylistId(channelId, apiKey);
  if (!uploadsPlaylistId) return [];

  const entries = [];
  let nextPageToken = null;
  let collected = 0;

  do {
    const payload = await fetchPlaylistItemsPage(
      uploadsPlaylistId,
      apiKey,
      nextPageToken,
    );
    const items = payload?.items || [];

    for (const item of items) {
      const snippet = item?.snippet || {};
      const videoId = snippet?.resourceId?.videoId;
      if (!videoId) continue;

      entries.push({
        path: `/videos/${encodeURIComponent(videoId)}/`,
        lastmod: toYoutubeDate(snippet.publishedAt, today),
        changefreq: 'weekly',
        priority: 0.7,
      });

      collected += 1;
      if (collected >= MAX_YOUTUBE_RESULTS) {
        return entries;
      }
    }

    nextPageToken = payload?.nextPageToken || null;
  } while (nextPageToken && collected < MAX_YOUTUBE_RESULTS);

  return entries;
}

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
    .filter((app) => app && typeof app.name === 'string' && app.name.trim())
    .map((app) => ({
      path: `/projekte/?app=${encodeURIComponent(app.name.trim())}`,
      lastmod: toISODate(app.lastUpdated) || today,
      changefreq: 'monthly',
      priority: 0.62,
    }));
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

  const [staticEntries, blogPostsPayload, projectAppsPayload, videoEntries] =
    await Promise.all([
      Promise.resolve(buildStaticEntries(today)),
      loadJsonAsset(context, BLOG_INDEX_PATH),
      loadJsonAsset(context, PROJECT_APPS_PATH),
      loadVideoEntries(context.env, today).catch(() => []),
    ]);

  const blogPosts = Array.isArray(blogPostsPayload) ? blogPostsPayload : [];
  const projectApps = Array.isArray(projectAppsPayload?.apps)
    ? projectAppsPayload.apps
    : [];

  const blogEntries = buildBlogEntries(blogPosts, today);
  const appEntries = buildProjectAppEntries(projectApps, today);
  const allEntries = [
    ...staticEntries,
    ...blogEntries,
    ...appEntries,
    ...videoEntries,
  ];

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
      'X-Robots-Tag': 'index, follow',
    },
  });
}
