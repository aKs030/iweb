import {
  escapeXml,
  loadJsonAsset,
  resolveOrigin,
  toAbsoluteUrl,
} from '../api/_xml-utils.js';
import {
  formatSlug,
  normalizeText,
  sanitizeDiscoveryText,
} from '../api/_text-utils.js';

const BLOG_INDEX_PATH = '/pages/blog/posts/index.json';
const PROJECT_APPS_PATH = '/pages/projekte/apps-config.json';
const INDEX_ROBOTS = 'index, follow, max-image-preview:large';
const NOINDEX_ROBOTS = 'noindex, follow';
const DEFAULT_BLOG_IMAGE =
  'https://img.abdulkerimsesli.de/blog/og-home-800.png';
const DEFAULT_APP_IMAGE =
  'https://img.abdulkerimsesli.de/blog/og-projekte-800.png';
const DEFAULT_VIDEO_IMAGE =
  'https://img.abdulkerimsesli.de/blog/og-videos-800.png';
const APP_PREVIEW_VERSION = '20260221';
const JSON_CACHE_TTL_MS = 5 * 60 * 1000;
const VIDEO_CACHE_TTL_MS = 30 * 60 * 1000;
const jsonCache = new Map();
const videoCache = new Map();

function normalizePathname(pathname) {
  const cleaned = String(pathname || '/').replace(/\/+/g, '/');
  return cleaned || '/';
}

function normalizeSlug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '');
}

function humanizeSlug(value) {
  return String(value || '')
    .split(/[-_]+/)
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

function isBlogDetailPath(pathname) {
  return /^\/blog\/[^/]+\/?$/i.test(pathname);
}

function isVideoDetailPath(pathname) {
  return /^\/videos\/[^/]+\/?$/i.test(pathname);
}

function extractSecondSegment(pathname) {
  const parts = String(pathname || '')
    .split('/')
    .filter(Boolean);
  if (parts.length < 2) return '';
  try {
    return decodeURIComponent(parts[1]);
  } catch {
    return parts[1];
  }
}

function normalizeVideoId(value) {
  return String(value || '')
    .trim()
    .replace(/[^A-Za-z0-9_-]/g, '');
}

function clampText(value, maxLength = 220) {
  const normalized = String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
}

function serializeJson(data) {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function injectBeforeHeadClose(html, snippet) {
  if (!snippet) return html;
  if (/<\/head>/i.test(html)) {
    return html.replace(/<\/head>/i, `${snippet}\n</head>`);
  }
  return `${html}\n${snippet}`;
}

function upsertTitle(html, title) {
  if (!title) return html;
  const tag = `<title>${escapeXml(title)}</title>`;

  if (/<title\b[^>]*>[\s\S]*?<\/title>/i.test(html)) {
    return html.replace(/<title\b[^>]*>[\s\S]*?<\/title>/i, tag);
  }

  return injectBeforeHeadClose(html, `  ${tag}`);
}

function upsertMetaByName(html, name, content) {
  if (!name || !content) return html;

  const tag = `  <meta name="${escapeXml(name)}" content="${escapeXml(content)}" />`;
  const pattern = new RegExp(
    `<meta\\b[^>]*\\bname=(['"])${escapeRegExp(name)}\\1[^>]*>`,
    'i',
  );

  if (pattern.test(html)) {
    return html.replace(pattern, tag.trim());
  }

  return injectBeforeHeadClose(html, tag);
}

function upsertMetaByProperty(html, property, content) {
  if (!property || !content) return html;

  const tag = `  <meta property="${escapeXml(property)}" content="${escapeXml(content)}" />`;
  const pattern = new RegExp(
    `<meta\\b[^>]*\\bproperty=(['"])${escapeRegExp(property)}\\1[^>]*>`,
    'i',
  );

  if (pattern.test(html)) {
    return html.replace(pattern, tag.trim());
  }

  return injectBeforeHeadClose(html, tag);
}

function upsertCanonical(html, href) {
  if (!href) return html;

  const tag = `  <link rel="canonical" href="${escapeXml(href)}" />`;
  const pattern = /<link\b[^>]*\brel=(['"])canonical\1[^>]*>/i;

  if (pattern.test(html)) {
    return html.replace(pattern, tag.trim());
  }

  return injectBeforeHeadClose(html, tag);
}

function upsertScriptById(html, id, scriptTag) {
  const pattern = new RegExp(
    `<script\\b[^>]*\\bid=(['"])${escapeRegExp(id)}\\1[^>]*>[\\s\\S]*?<\\/script>`,
    'i',
  );

  if (pattern.test(html)) {
    return html.replace(pattern, scriptTag.trim());
  }

  return injectBeforeHeadClose(html, `  ${scriptTag}`);
}

function upsertPartialMetaScript(html, partialMeta) {
  if (!partialMeta || typeof partialMeta !== 'object') return html;

  const payload = serializeJson(partialMeta);
  const scriptTag = `<script type="application/json" id="edge-partial-meta" data-partial-meta>${payload}</script>`;

  return upsertScriptById(html, 'edge-partial-meta', scriptTag);
}

function upsertRouteSchemaScript(html, schema) {
  if (!schema || typeof schema !== 'object') return html;

  const payload = serializeJson(schema);
  const scriptTag = `<script type="application/ld+json" id="edge-route-schema">${payload}</script>`;

  return upsertScriptById(html, 'edge-route-schema', scriptTag);
}

async function loadJsonCached(context, path, ttlMs = JSON_CACHE_TTL_MS) {
  const now = Date.now();
  const cached = jsonCache.get(path);

  if (cached && now - cached.updatedAt < ttlMs) {
    return cached.value;
  }

  const payload = await loadJsonAsset(context, path);
  if (payload != null) {
    jsonCache.set(path, { value: payload, updatedAt: now });
    return payload;
  }

  return cached?.value ?? null;
}

function bestVideoThumbnail(snippet) {
  const thumbs = snippet?.thumbnails || {};
  return (
    thumbs.maxres?.url ||
    thumbs.standard?.url ||
    thumbs.high?.url ||
    thumbs.medium?.url ||
    thumbs.default?.url ||
    ''
  );
}

async function loadVideoDetails(context, videoId) {
  const now = Date.now();
  const cached = videoCache.get(videoId);
  if (cached && now - cached.updatedAt < VIDEO_CACHE_TTL_MS) {
    return cached.value;
  }

  const apiKey = normalizeText(context.env?.YOUTUBE_API_KEY);
  if (!apiKey) {
    return cached?.value ?? null;
  }

  const endpoint = new URL('https://www.googleapis.com/youtube/v3/videos');
  endpoint.searchParams.set('part', 'snippet,contentDetails,statistics');
  endpoint.searchParams.set('id', videoId);
  endpoint.searchParams.set('key', apiKey);

  let value = null;

  try {
    const response = await fetch(endpoint.toString());
    if (response.ok) {
      const payload = await response.json();
      const item = Array.isArray(payload?.items) ? payload.items[0] : null;
      if (item) {
        const requiredChannelId = normalizeText(
          context.env?.YOUTUBE_CHANNEL_ID,
        );
        const itemChannelId = normalizeText(item?.snippet?.channelId);
        if (
          !requiredChannelId ||
          !itemChannelId ||
          requiredChannelId === itemChannelId
        ) {
          value = item;
        }
      }
    }
  } catch {
    // Keep stale cache when API requests fail.
  }

  if (value) {
    videoCache.set(videoId, { value, updatedAt: now });
    return value;
  }

  return cached?.value ?? null;
}

function applyRouteMeta(html, meta) {
  let next = html;

  next = upsertTitle(next, meta.title);
  next = upsertCanonical(next, meta.canonicalUrl);
  next = upsertMetaByName(next, 'description', meta.description);
  next = upsertMetaByName(next, 'robots', meta.robots || INDEX_ROBOTS);
  next = upsertMetaByName(
    next,
    'twitter:card',
    meta.twitterCard || 'summary_large_image',
  );
  next = upsertMetaByName(next, 'twitter:title', meta.title);
  next = upsertMetaByName(next, 'twitter:description', meta.description);
  next = upsertMetaByName(next, 'twitter:url', meta.canonicalUrl);
  next = upsertMetaByProperty(next, 'og:type', meta.ogType || 'website');
  next = upsertMetaByProperty(next, 'og:title', meta.title);
  next = upsertMetaByProperty(next, 'og:description', meta.description);
  next = upsertMetaByProperty(next, 'og:url', meta.canonicalUrl);

  if (meta.keywords) {
    next = upsertMetaByName(next, 'keywords', meta.keywords);
  }

  if (meta.image) {
    next = upsertMetaByProperty(next, 'og:image', meta.image);
    next = upsertMetaByName(next, 'twitter:image', meta.image);
  }

  if (meta.publishedTime) {
    next = upsertMetaByProperty(
      next,
      'article:published_time',
      meta.publishedTime,
    );
  }

  next = upsertPartialMetaScript(next, meta.partialMeta);
  next = upsertRouteSchemaScript(next, meta.schema);

  return next;
}

async function buildBlogMeta(context, requestUrl, postId) {
  const origin = resolveOrigin(requestUrl.toString());
  const postsIndex = await loadJsonCached(context, BLOG_INDEX_PATH);
  const posts = Array.isArray(postsIndex) ? postsIndex : [];
  const bySlug = new Map();

  for (const post of posts) {
    const id = normalizeText(post?.id);
    if (!id) continue;
    bySlug.set(normalizeSlug(id), post);
  }

  const post = bySlug.get(normalizeSlug(postId));
  if (!post) {
    return {
      title: 'Blog — Abdulkerim Sesli',
      description: 'Der angefragte Blogbeitrag wurde nicht gefunden.',
      canonicalUrl: `${origin}/blog/`,
      robots: NOINDEX_ROBOTS,
      ogType: 'website',
      image: DEFAULT_BLOG_IMAGE,
      twitterCard: 'summary_large_image',
      partialMeta: {
        title: 'Blog — Abdulkerim Sesli',
        description: 'Der angefragte Blogbeitrag wurde nicht gefunden.',
        image: DEFAULT_BLOG_IMAGE,
        robots: NOINDEX_ROBOTS,
      },
      schema: null,
    };
  }

  const safeId = normalizeText(post.id, postId);
  const postTitle = sanitizeDiscoveryText(post.title, formatSlug(safeId));
  const description = clampText(
    sanitizeDiscoveryText(
      post.seoDescription || post.excerpt,
      `${postTitle} - Blogbeitrag von Abdulkerim Sesli`,
    ),
    220,
  );
  const canonicalUrl = `${origin}/blog/${encodeURIComponent(safeId)}/`;
  const image = toAbsoluteUrl(
    origin,
    normalizeText(post.image, DEFAULT_BLOG_IMAGE),
  );
  const keywordList = Array.isArray(post.keywords)
    ? post.keywords
    : String(post.keywords || '')
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean);
  const keywords = keywordList.length
    ? [...new Set(keywordList)].join(', ')
    : `${postTitle}, Blog, Abdulkerim Sesli`;

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    '@id': `${canonicalUrl}#article`,
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonicalUrl },
    headline: postTitle,
    description,
    image: [image],
    datePublished: normalizeText(post.date),
    dateModified: normalizeText(post.date),
    inLanguage: 'de-DE',
    author: {
      '@type': 'Person',
      name: 'Abdulkerim Sesli',
      url: `${origin}/`,
    },
    publisher: {
      '@type': 'Organization',
      '@id': `${origin}/#organization`,
      name: 'Abdulkerim Sesli',
      url: `${origin}/`,
    },
    isPartOf: {
      '@type': 'Blog',
      '@id': `${origin}/blog/#blog`,
      url: `${origin}/blog/`,
    },
    keywords,
  };

  return {
    title: `${postTitle} — Abdulkerim Sesli`,
    description,
    canonicalUrl,
    robots: INDEX_ROBOTS,
    ogType: 'article',
    image,
    keywords,
    publishedTime: normalizeText(post.date),
    twitterCard: 'summary_large_image',
    partialMeta: {
      title: `${postTitle} — Abdulkerim Sesli`,
      description,
      image,
      type: 'BlogPosting',
      ogType: 'article',
      keywords,
      datePublished: normalizeText(post.date),
    },
    schema,
  };
}

async function buildProjectAppMeta(context, requestUrl, appSlug) {
  const origin = resolveOrigin(requestUrl.toString());
  const payload = await loadJsonCached(context, PROJECT_APPS_PATH);
  const apps = Array.isArray(payload?.apps) ? payload.apps : [];
  const bySlug = new Map();

  for (const app of apps) {
    const appName = normalizeText(app?.name);
    if (!appName) continue;
    bySlug.set(normalizeSlug(appName), app);
  }

  const app = bySlug.get(normalizeSlug(appSlug));
  if (!app) {
    return {
      title: 'Projekte — Abdulkerim Sesli',
      description: 'Die angefragte App wurde nicht gefunden.',
      canonicalUrl: `${origin}/projekte/`,
      robots: NOINDEX_ROBOTS,
      ogType: 'website',
      image: DEFAULT_APP_IMAGE,
      twitterCard: 'summary_large_image',
      partialMeta: {
        title: 'Projekte — Abdulkerim Sesli',
        description: 'Die angefragte App wurde nicht gefunden.',
        image: DEFAULT_APP_IMAGE,
        robots: NOINDEX_ROBOTS,
      },
      schema: null,
    };
  }

  const appName = normalizeText(app.name, appSlug);
  const appTitle = sanitizeDiscoveryText(
    app.title,
    humanizeSlug(appName) || formatSlug(appName),
  );
  const canonicalUrl = `${origin}/projekte/?app=${encodeURIComponent(appName)}`;
  const description = clampText(
    sanitizeDiscoveryText(
      app.description,
      `${appTitle} - Interaktive Web-App von Abdulkerim Sesli`,
    ),
    220,
  );
  const image = `https://img.abdulkerimsesli.de/app/${encodeURIComponent(appName)}.svg?v=${APP_PREVIEW_VERSION}`;
  const tags = Array.isArray(app.tags)
    ? app.tags.map((entry) => normalizeText(entry)).filter(Boolean)
    : [];
  const keywords = [
    ...new Set([appTitle, 'Projekte', 'Web App', ...tags]),
  ].join(', ');

  const appType = normalizeText(app.category, 'WebApplication');
  const schemaType =
    appType.toLowerCase() === 'game'
      ? 'GameApplication'
      : 'SoftwareApplication';

  const schema = {
    '@context': 'https://schema.org',
    '@type': schemaType,
    '@id': `${canonicalUrl}#app`,
    name: appTitle,
    description,
    applicationCategory: schemaType,
    applicationSubCategory: appType,
    operatingSystem: 'Any',
    url: canonicalUrl,
    image: [image],
    author: {
      '@type': 'Person',
      name: 'Abdulkerim Sesli',
      url: `${origin}/`,
    },
    isPartOf: {
      '@type': 'CollectionPage',
      '@id': `${origin}/projekte/#projects-list`,
      url: `${origin}/projekte/`,
    },
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'EUR',
      availability: 'https://schema.org/InStock',
    },
  };

  return {
    title: `${appTitle} — Projekte | Abdulkerim Sesli`,
    description,
    canonicalUrl,
    robots: INDEX_ROBOTS,
    ogType: 'website',
    image,
    keywords,
    twitterCard: 'summary_large_image',
    partialMeta: {
      title: `${appTitle} — Projekte | Abdulkerim Sesli`,
      description,
      image,
      type: schemaType,
      ogType: 'website',
      keywords,
    },
    schema,
  };
}

async function buildVideoMeta(context, requestUrl, videoId) {
  const origin = resolveOrigin(requestUrl.toString());
  const details = await loadVideoDetails(context, videoId);

  if (!details?.snippet) {
    return {
      title: 'Videos — Abdulkerim Sesli',
      description: 'Der angefragte Videoinhalt wurde nicht gefunden.',
      canonicalUrl: `${origin}/videos/`,
      robots: NOINDEX_ROBOTS,
      ogType: 'website',
      image: DEFAULT_VIDEO_IMAGE,
      twitterCard: 'summary_large_image',
      partialMeta: {
        title: 'Videos — Abdulkerim Sesli',
        description: 'Der angefragte Videoinhalt wurde nicht gefunden.',
        image: DEFAULT_VIDEO_IMAGE,
        robots: NOINDEX_ROBOTS,
      },
      schema: null,
    };
  }

  const snippet = details.snippet || {};
  const title = sanitizeDiscoveryText(snippet.title, `Video ${videoId}`);
  const description = clampText(
    sanitizeDiscoveryText(
      snippet.description,
      `${title} - Video von Abdulkerim Sesli`,
    ),
    220,
  );
  const canonicalUrl = `${origin}/videos/${encodeURIComponent(videoId)}/`;
  const image = normalizeText(bestVideoThumbnail(snippet), DEFAULT_VIDEO_IMAGE);

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    '@id': `${canonicalUrl}#video`,
    name: title,
    description,
    thumbnailUrl: image,
    uploadDate: normalizeText(snippet.publishedAt),
    duration: normalizeText(details.contentDetails?.duration),
    embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}`,
    contentUrl: `https://www.youtube.com/watch?v=${videoId}`,
    url: canonicalUrl,
    isFamilyFriendly: true,
    publisher: {
      '@type': 'Organization',
      '@id': `${origin}/#organization`,
      name: 'Abdulkerim Sesli',
      url: `${origin}/`,
    },
  };

  if (!schema.duration) {
    delete schema.duration;
  }

  return {
    title: `${title} — Videos | Abdulkerim Sesli`,
    description,
    canonicalUrl,
    robots: INDEX_ROBOTS,
    ogType: 'video.other',
    image,
    twitterCard: 'summary_large_image',
    partialMeta: {
      title: `${title} — Videos | Abdulkerim Sesli`,
      description,
      image,
      type: 'VideoObject',
      ogType: 'video.other',
      datePublished: normalizeText(snippet.publishedAt),
    },
    schema,
  };
}

export async function buildRouteMeta(context, requestUrl) {
  const pathname = normalizePathname(requestUrl.pathname);

  if (isBlogDetailPath(pathname)) {
    const postId = extractSecondSegment(pathname);
    if (!postId || postId.toLowerCase() === 'index.html') return null;
    return buildBlogMeta(context, requestUrl, postId);
  }

  if (/^\/projekte\/?$/i.test(pathname)) {
    const appSlug = normalizeText(requestUrl.searchParams.get('app'));
    if (appSlug) {
      return buildProjectAppMeta(context, requestUrl, appSlug);
    }
    return null;
  }

  if (isVideoDetailPath(pathname)) {
    const rawVideoId = extractSecondSegment(pathname);
    const videoId = normalizeVideoId(rawVideoId);
    if (videoId.length < 6 || videoId.length > 20) return null;
    return buildVideoMeta(context, requestUrl, videoId);
  }

  return null;
}

export async function applyRouteSeo(context, html, requestUrl) {
  const routeMeta = await buildRouteMeta(context, requestUrl);
  if (!routeMeta) return html;
  return applyRouteMeta(html, routeMeta);
}
