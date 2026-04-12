import {
  loadJsonFile,
  resolveOrigin,
  toAbsoluteUrl,
} from '../api/_xml-utils.js';
import {
  formatSlug,
  normalizeText,
  sanitizeDiscoveryText,
} from '../api/_text-utils.js';
import {
  buildProjectCanonicalUrl,
  extractProjectSlug,
} from '../../content/core/project-paths.js';
import { ROUTES } from '../../content/config/routes-config.js';
import {
  buildProjectPreviewUrl,
  OG_HOME_IMAGE_URL,
  OG_PROJECTS_IMAGE_URL,
  OG_VIDEOS_IMAGE_URL,
} from '../../content/config/media-urls.js';
import {
  SITE_NAME,
  SITE_PERSON_DISCOVERY_ALIASES,
  SITE_PERSON_JOB_TITLES,
  SITE_PERSON_KNOWS_ABOUT,
  SITE_PERSON_SOCIAL_URLS,
  SITE_WEBSITE_ALT_NAME,
} from '../../content/config/site-seo.js';

const BLOG_INDEX_PATH = '/pages/blog/posts/index.json';
const PROJECT_APPS_PATH = '/pages/projekte/apps-config.json';
const INDEX_ROBOTS = 'index, follow, max-image-preview:large';
const NOINDEX_ROBOTS = 'noindex, follow';
const DEFAULT_BLOG_IMAGE = OG_HOME_IMAGE_URL;
const DEFAULT_APP_IMAGE = OG_PROJECTS_IMAGE_URL;
const DEFAULT_VIDEO_IMAGE = OG_VIDEOS_IMAGE_URL;
const DEFAULT_SITE_NAME = SITE_NAME;
const DEFAULT_LOCALE = 'de_DE';
const DEFAULT_IMAGE_WIDTH = '1200';
const DEFAULT_IMAGE_HEIGHT = '630';
const DEFAULT_IMAGE_TYPE = 'image/png';
const JSON_CACHE_TTL_MS = 5 * 60 * 1000;
const VIDEO_CACHE_TTL_MS = 30 * 60 * 1000;
const jsonCache = new Map();
const videoCache = new Map();

function buildAiInfoSchema({ canonicalUrl, origin }) {
  const personId = `${origin}/#person`;
  const websiteId = `${origin}/#website`;

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Person',
        '@id': personId,
        name: 'Abdulkerim Sesli',
        alternateName: [...SITE_PERSON_DISCOVERY_ALIASES],
        url: `${origin}/`,
        jobTitle: [...SITE_PERSON_JOB_TITLES],
        description:
          'Full-Stack Web Developer mit Fokus auf moderne JavaScript-Architekturen, Three.js-Erlebnisse, Edge-Deployment und AI-Integration.',
        sameAs: [...SITE_PERSON_SOCIAL_URLS],
        knowsAbout: [...SITE_PERSON_KNOWS_ABOUT],
      },
      {
        '@type': 'WebSite',
        '@id': websiteId,
        url: `${origin}/`,
        name: SITE_WEBSITE_ALT_NAME,
        inLanguage: ['de', 'en'],
        publisher: { '@id': personId },
      },
      {
        '@type': 'FAQPage',
        '@id': `${canonicalUrl}#faq`,
        name: 'AI Discovery FAQ',
        isPartOf: { '@id': websiteId },
        mainEntity: [
          {
            '@type': 'Question',
            '@id': `${canonicalUrl}#faq-name`,
            name: 'Wie lautet die bevorzugte Namensform?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Bevorzugt: Abdulkerim Sesli. Zulaessige Aliase: Abdul Sesli, AKS, aKs030.',
            },
          },
          {
            '@type': 'Question',
            '@id': `${canonicalUrl}#faq-topics`,
            name: 'Welche Themen beschreiben die Website am besten?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Full-Stack-Webentwicklung, JavaScript, Three.js, Web Performance, Edge Deployment, AI-Integration, technische SEO.',
            },
          },
          {
            '@type': 'Question',
            '@id': `${canonicalUrl}#faq-profile`,
            name: 'Wo gibt es die vollstaendige Profil-Information?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Unter /about/, /person.jsonld, /llms-full.txt und /ai-index.json.',
            },
          },
        ],
      },
    ],
  };
}

const STATIC_ROUTE_SERVER_OVERRIDES = Object.freeze({
  '/ai-info/': Object.freeze({
    schema: buildAiInfoSchema,
  }),
});

const STATIC_ROUTE_META = Object.freeze(
  Object.fromEntries([
    [
      '/',
      Object.freeze({
        title: ROUTES.default.title,
        appTitle: ROUTES.default.appTitle || ROUTES.default.title,
        description: ROUTES.default.description,
        ogType: ROUTES.default.ogType,
        ogTitle: ROUTES.default.ogTitle,
        ogDescription: ROUTES.default.ogDescription,
        twitterTitle: ROUTES.default.twitterTitle,
        twitterDescription: ROUTES.default.twitterDescription,
        image: ROUTES.default.image,
        type: ROUTES.default.type,
        robots: ROUTES.default.robots,
        keywords: ROUTES.default.keywords,
      }),
    ],
    ...Object.entries(ROUTES)
      .filter(([pathname]) => pathname !== 'default' && pathname.startsWith('/'))
      .map(([pathname, route]) => [
        pathname,
        Object.freeze({
          title: route.title,
          appTitle: route.appTitle || route.title,
          description: route.description,
          ogType: route.ogType,
          ogTitle: route.ogTitle,
          ogDescription: route.ogDescription,
          twitterTitle: route.twitterTitle,
          twitterDescription: route.twitterDescription,
          image: route.image,
          type: route.type,
          robots: route.robots,
          keywords: route.keywords,
          ...STATIC_ROUTE_SERVER_OVERRIDES[pathname],
        }),
      ]),
  ]),
);

function normalizePathname(pathname) {
  const cleaned = String(pathname || '/').replace(/\/+/g, '/');
  const withoutIndex = cleaned.replace(/\/index\.html$/i, '/');
  return withoutIndex || '/';
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
    .reduce((acc, rawSegment) => {
      const segment = rawSegment.trim();
      if (segment) {
        acc.push(segment.charAt(0).toUpperCase() + segment.slice(1));
      }
      return acc;
    }, [])
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

function toStaticRouteKey(pathname) {
  if (pathname === '/') return '/';
  return pathname.endsWith('/') ? pathname : `${pathname}/`;
}

function buildStaticPageMeta(requestUrl, pathname, config) {
  const origin = resolveOrigin(requestUrl.toString());
  const description = clampText(config.description, 220);
  const image = normalizeText(config.image, DEFAULT_BLOG_IMAGE);
  const title = normalizeText(config.title);
  const canonicalPath = normalizeText(config.canonicalPath, pathname);
  const canonicalUrl = `${origin}${canonicalPath}`;
  const schema =
    typeof config.schema === 'function'
      ? config.schema({
          canonicalUrl,
          origin,
          title,
          description,
          image,
        })
      : config.schema || null;
  const partialMeta =
    config.partialMeta && typeof config.partialMeta === 'object'
      ? { ...config.partialMeta }
      : null;

  return {
    title,
    description,
    canonicalUrl,
    robots: normalizeText(config.robots, INDEX_ROBOTS),
    ogType: normalizeText(config.ogType, 'website'),
    ogTitle: normalizeText(config.ogTitle, title),
    ogDescription: normalizeText(config.ogDescription, description),
    twitterCard: normalizeText(config.twitterCard, 'summary_large_image'),
    twitterTitle: normalizeText(
      config.twitterTitle,
      normalizeText(config.ogTitle, title),
    ),
    twitterDescription: normalizeText(
      config.twitterDescription,
      normalizeText(config.ogDescription, description),
    ),
    appTitle: normalizeText(config.appTitle, title),
    siteName: DEFAULT_SITE_NAME,
    locale: DEFAULT_LOCALE,
    image,
    imageAlt: normalizeText(config.imageAlt, title),
    imageWidth: DEFAULT_IMAGE_WIDTH,
    imageHeight: DEFAULT_IMAGE_HEIGHT,
    imageType: DEFAULT_IMAGE_TYPE,
    keywords: normalizeText(config.keywords),
    partialMeta,
    schema,
  };
}

async function loadJsonCached(context, path, ttlMs = JSON_CACHE_TTL_MS) {
  const now = Date.now();
  const cached = jsonCache.get(path);

  if (cached && now - cached.updatedAt < ttlMs) {
    return cached.value;
  }

  const payload = await loadJsonFile(context, path);
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
      imageAlt: 'Blog — Abdulkerim Sesli',
      twitterCard: 'summary_large_image',
      partialMeta: {
        title: 'Blog — Abdulkerim Sesli',
        description: 'Der angefragte Blogbeitrag wurde nicht gefunden.',
        image: DEFAULT_BLOG_IMAGE,
        imageAlt: 'Blog — Abdulkerim Sesli',
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
  const imageAlt = sanitizeDiscoveryText(
    post.imageAlt,
    `${postTitle} - Artikelbild`,
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
  const publishedTime = normalizeText(post.date);
  const modifiedTime = normalizeText(post.updated || post.date);

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    '@id': `${canonicalUrl}#article`,
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonicalUrl },
    headline: postTitle,
    description,
    image: [image],
    datePublished: publishedTime,
    dateModified: modifiedTime,
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
    imageAlt,
    keywords,
    publishedTime,
    modifiedTime,
    twitterCard: 'summary_large_image',
    partialMeta: {
      title: `${postTitle} — Abdulkerim Sesli`,
      description,
      image,
      imageAlt,
      type: 'BlogPosting',
      ogType: 'article',
      keywords,
      datePublished: publishedTime,
      dateModified: modifiedTime,
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
  const canonicalUrl = buildProjectCanonicalUrl(origin, appName);
  const description = clampText(
    sanitizeDiscoveryText(
      app.description,
      `${appTitle} - Interaktive Web-App von Abdulkerim Sesli`,
    ),
    220,
  );
  const image =
    normalizeText(app?.previewUrl) ||
    buildProjectPreviewUrl(app) ||
    DEFAULT_APP_IMAGE;
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

  const appSlug = extractProjectSlug(pathname, requestUrl.search);
  if (appSlug) {
    return buildProjectAppMeta(context, requestUrl, appSlug);
  }

  if (isVideoDetailPath(pathname)) {
    const rawVideoId = extractSecondSegment(pathname);
    const videoId = normalizeVideoId(rawVideoId);
    if (videoId.length < 6 || videoId.length > 20) return null;
    return buildVideoMeta(context, requestUrl, videoId);
  }

  const staticRouteKey = toStaticRouteKey(pathname);
  if (STATIC_ROUTE_META[staticRouteKey]) {
    return buildStaticPageMeta(
      requestUrl,
      staticRouteKey,
      STATIC_ROUTE_META[staticRouteKey],
    );
  }

  return null;
}
