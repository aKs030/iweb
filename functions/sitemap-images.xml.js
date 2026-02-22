import {
  escapeXml,
  loadJsonAsset,
  normalizePath,
  resolveOrigin,
  toAbsoluteUrl,
} from './api/_xml-utils.js';
import {
  normalizeText,
  sanitizeDiscoveryText,
  formatSlug,
} from './api/_text-utils.js';
import {
  fetchPlaylistItemsPage,
  fetchUploadsPlaylistId,
  getBestYouTubeThumbnail,
} from './api/_youtube-utils.js';

const LICENSE_URL = 'https://www.abdulkerimsesli.de/#image-license';
const BLOG_INDEX_PATH = '/pages/blog/posts/index.json';
const PROJECT_APPS_PATH = '/pages/projekte/apps-config.json';
const R2_DOMAIN = 'https://img.abdulkerimsesli.de';
const R2_APP_PREVIEWS_BASE_URL = `${R2_DOMAIN}/app`;
const APP_PREVIEWS_VERSION = '20260221';
const MAX_YOUTUBE_RESULTS = 200;

const STATIC_PAGE_IMAGES = [
  {
    page: '/',
    image: 'https://img.abdulkerimsesli.de/blog/og-home-800.png',
    title: 'Abdulkerim Sesli Startseite',
    caption:
      'Zentrale Hauptseite mit Portfolio, Blog, Bildern, Videos und Projekten',
  },
  {
    page: '/about/',
    image: 'https://img.abdulkerimsesli.de/icons/favicon-512.webp?v=20260221',
    title: 'Abdulkerim Sesli',
    caption:
      'Profilseite mit Hintergrund, Themenfeldern und redaktionellen Inhalten',
  },
  {
    page: '/contact/',
    image: 'https://img.abdulkerimsesli.de/blog/og-home-800.png',
    title: 'Kontakt',
    caption: 'Kontaktseite mit E-Mail, Formular und Kommunikationswegen',
  },
  {
    page: '/abdul-sesli/',
    image: 'https://img.abdulkerimsesli.de/blog/og-home-800.png',
    title: 'Abdul Sesli',
    caption: 'Alias-Seite: Abdul Sesli ist die Kurzform von Abdulkerim Sesli',
  },
  {
    page: '/blog/',
    image: 'https://img.abdulkerimsesli.de/blog/og-design-800.png',
    title: 'Tech Blog',
    caption:
      'Blog mit Artikeln zu Webentwicklung, SEO, Performance, React und TypeScript',
  },
  {
    page: '/gallery/',
    image: 'https://img.abdulkerimsesli.de/blog/og-photography-800.png',
    title: 'Fotografie Portfolio',
    caption:
      'Bildgalerie mit Portraits, Street-Fotografie und visuellen Serien',
  },
  {
    page: '/videos/',
    image: 'https://img.abdulkerimsesli.de/blog/og-videos-800.png',
    title: 'Videos',
    caption:
      'Videoseite mit YouTube-Inhalten, Clips, Making-of und Story-Formaten',
  },
  {
    page: '/projekte/',
    image: 'https://img.abdulkerimsesli.de/blog/og-projekte-800.png',
    title: 'Code Projekte',
    caption:
      'Interaktive Webprojekte mit JavaScript, React, UI und Frontend-Experimenten',
  },
  {
    page: '/impressum/',
    image: 'https://img.abdulkerimsesli.de/blog/og-home-800.png',
    title: 'Impressum',
    caption: 'Rechtliche Informationen',
  },
  {
    page: '/datenschutz/',
    image: 'https://img.abdulkerimsesli.de/blog/og-home-800.png',
    title: 'Datenschutz',
    caption: 'DSGVO und Datenverarbeitung',
  },
];

function ensureUrlEntry(urlMap, pagePath) {
  const rawPath = String(pagePath || '').trim();
  const [pathname, query] = rawPath.split('?');
  const normalizedPath = normalizePath(pathname);
  const path = query ? `${normalizedPath}?${query}` : normalizedPath;
  if (!urlMap.has(path)) {
    urlMap.set(path, []);
  }
  return urlMap.get(path);
}

function addImage(urlMap, pagePath, image) {
  const images = ensureUrlEntry(urlMap, pagePath);
  if (!image?.loc) return;

  const exists = images.some((existing) => existing.loc === image.loc);
  if (exists) return;

  images.push(image);
}

function addStaticImages(urlMap, origin) {
  for (const item of STATIC_PAGE_IMAGES) {
    addImage(urlMap, item.page, {
      loc: toAbsoluteUrl(origin, item.image),
      title: item.title,
      caption: item.caption,
      license: LICENSE_URL,
    });
  }
}

function addBlogImages(urlMap, origin, posts) {
  if (!Array.isArray(posts)) return;

  for (const post of posts) {
    const id = normalizeText(post?.id);
    const image = normalizeText(post?.image);
    if (!id || !image) continue;

    const cleanTitle = sanitizeDiscoveryText(post.title, `Blog Artikel ${id}`);
    const cleanCaption = sanitizeDiscoveryText(
      post.seoDescription || post.excerpt,
      `${cleanTitle || id} - Blogbeitrag mit Bildern, Codebeispielen und Kontext`,
    );

    addImage(urlMap, `/blog/${encodeURIComponent(id)}/`, {
      loc: toAbsoluteUrl(origin, image),
      title: cleanTitle,
      caption: cleanCaption,
      license: LICENSE_URL,
    });
  }
}

function addProjectPreviewImages(urlMap, origin, appsConfig) {
  const apps = Array.isArray(appsConfig?.apps) ? appsConfig.apps : [];
  for (const app of apps) {
    const name = normalizeText(app?.name);
    if (!name) continue;

    const appPath = `/projekte/?app=${encodeURIComponent(name)}`;
    const appTitle = sanitizeDiscoveryText(app?.title, formatSlug(name));
    const appCaption = sanitizeDiscoveryText(
      app?.description,
      formatSlug(name),
    );

    addImage(urlMap, '/projekte/', {
      loc: `${R2_APP_PREVIEWS_BASE_URL}/${encodeURIComponent(name)}.svg?v=${APP_PREVIEWS_VERSION}`,
      title: appTitle,
      caption: appCaption,
      license: LICENSE_URL,
    });

    addImage(urlMap, appPath, {
      loc: `${R2_APP_PREVIEWS_BASE_URL}/${encodeURIComponent(name)}.svg?v=${APP_PREVIEWS_VERSION}`,
      title: appTitle,
      caption: appCaption,
      license: LICENSE_URL,
    });
  }
}

function extractFilenameFromKey(key = '') {
  const filename = key.split('/').pop() || key;
  return formatSlug(filename);
}

async function addGalleryR2Images(urlMap, bucket) {
  if (!bucket) return;

  let cursor;
  do {
    const list = await bucket.list({ prefix: 'Gallery/', cursor });
    const objects = list?.objects || [];

    for (const obj of objects) {
      if (!/\.(jpg|jpeg|png|webp|gif|svg)$/i.test(obj.key)) continue;

      const encodedKey = encodeURIComponent(obj.key).replace(/%2F/g, '/');
      const title = extractFilenameFromKey(obj.key);

      addImage(urlMap, '/gallery/', {
        loc: `${R2_DOMAIN}/${encodedKey}`,
        title: sanitizeDiscoveryText(title, 'Gallery Image'),
        caption: `${sanitizeDiscoveryText(title, 'Gallery Image')} - Fotoinhalt aus der Bildgalerie von Abdulkerim Sesli`,
        license: LICENSE_URL,
      });
    }

    cursor = list?.truncated ? list.cursor : undefined;
  } while (cursor);
}

async function addYouTubeVideoImages(urlMap, env) {
  const channelId = env?.YOUTUBE_CHANNEL_ID;
  const apiKey = env?.YOUTUBE_API_KEY;
  if (!channelId || !apiKey) return;

  const uploadsPlaylistId = await fetchUploadsPlaylistId(channelId, apiKey);
  if (!uploadsPlaylistId) return;

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
      const thumbnail = getBestYouTubeThumbnail(snippet);
      if (!videoId || !thumbnail) continue;

      const title = sanitizeDiscoveryText(snippet.title, `Video ${videoId}`);
      const description = sanitizeDiscoveryText(
        snippet.description,
        `${title} - Videoinhalt mit Beschreibung und Kontext`,
      );

      addImage(urlMap, `/videos/${encodeURIComponent(videoId)}/`, {
        loc: thumbnail,
        title,
        caption: description,
      });

      collected += 1;
      if (collected >= MAX_YOUTUBE_RESULTS) {
        return;
      }
    }

    nextPageToken = payload?.nextPageToken || null;
  } while (nextPageToken && collected < MAX_YOUTUBE_RESULTS);
}

function buildXml(origin, urlMap) {
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
    '        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
  ];

  const sortedPaths = [...urlMap.keys()].sort();

  for (const path of sortedPaths) {
    const images = urlMap.get(path) || [];
    if (!images.length) continue;

    lines.push('  <url>');
    lines.push(`    <loc>${escapeXml(`${origin}${path}`)}</loc>`);

    for (const image of images) {
      lines.push('    <image:image>');
      lines.push(`      <image:loc>${escapeXml(image.loc)}</image:loc>`);
      if (image.title) {
        lines.push(
          `      <image:title>${escapeXml(image.title)}</image:title>`,
        );
      }
      if (image.caption) {
        lines.push(
          `      <image:caption>${escapeXml(image.caption)}</image:caption>`,
        );
      }
      if (image.license) {
        lines.push(
          `      <image:license>${escapeXml(image.license)}</image:license>`,
        );
      }
      lines.push('    </image:image>');
    }

    lines.push('  </url>');
  }

  lines.push('</urlset>');
  return lines.join('\n');
}

export async function onRequest(context) {
  const origin = resolveOrigin(context.request.url);
  const urlMap = new Map();

  addStaticImages(urlMap, origin);

  const [posts, appsConfig] = await Promise.all([
    loadJsonAsset(context, BLOG_INDEX_PATH),
    loadJsonAsset(context, PROJECT_APPS_PATH),
  ]);

  addBlogImages(urlMap, origin, posts);
  addProjectPreviewImages(urlMap, origin, appsConfig);

  try {
    await addYouTubeVideoImages(urlMap, context.env);
  } catch {
    // Keep sitemap valid even if YouTube API is unavailable.
  }

  try {
    await addGalleryR2Images(urlMap, context.env?.GALLERY_BUCKET);
  } catch {
    // Keep static + blog + project images even if R2 listing fails.
  }

  const xml = buildXml(origin, urlMap);

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      'X-Robots-Tag': 'index, follow',
    },
  });
}
