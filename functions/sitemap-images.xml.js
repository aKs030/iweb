const LICENSE_URL = 'https://www.abdulkerimsesli.de/#image-license';
const BLOG_INDEX_PATH = '/pages/blog/posts/index.json';
const PROJECT_APPS_PATH = '/pages/projekte/apps-config.json';
const R2_DOMAIN = 'https://img.abdulkerimsesli.de';

const STATIC_PAGE_IMAGES = [
  {
    page: '/',
    image: '/content/assets/img/og/og-home-800.svg',
    title: 'Abdulkerim Sesli Startseite',
    caption: 'Digital Creator Portfolio',
  },
  {
    page: '/about/',
    image: '/content/assets/img/icons/favicon-512.webp',
    title: 'Abdulkerim Sesli',
    caption: 'Über mich',
  },
  {
    page: '/blog/',
    image: '/content/assets/img/og/og-design-800.svg',
    title: 'Tech Blog',
    caption: 'Webentwicklung, SEO und Performance',
  },
  {
    page: '/gallery/',
    image: '/content/assets/img/og/og-photography-800.svg',
    title: 'Fotografie Portfolio',
    caption: 'Urban & Portrait Berlin',
  },
  {
    page: '/videos/',
    image: '/content/assets/img/og/og-videos-800.svg',
    title: 'Videos',
    caption: 'YouTube und Behind-the-Scenes',
  },
  {
    page: '/projekte/',
    image: '/content/assets/img/og/og-projekte-800.svg',
    title: 'Code Projekte',
    caption: 'Interaktive Web-Experimente',
  },
  {
    page: '/contact/',
    image: '/content/assets/img/og/og-home-800.svg',
    title: 'Kontakt',
    caption: 'Projektanfrage und Zusammenarbeit',
  },
  {
    page: '/impressum/',
    image: '/content/assets/img/og/og-home-800.svg',
    title: 'Impressum',
    caption: 'Rechtliche Informationen',
  },
  {
    page: '/datenschutz/',
    image: '/content/assets/img/og/og-home-800.svg',
    title: 'Datenschutz',
    caption: 'DSGVO und Datenverarbeitung',
  },
];

function normalizePath(path) {
  if (!path) return '/';
  if (path === '/') return '/';

  let normalized = String(path).trim();
  if (!normalized.startsWith('/')) normalized = '/' + normalized;
  normalized = normalized.replace(/\/index\.html?$/i, '/');
  if (!normalized.endsWith('/')) normalized += '/';

  return normalized;
}

function resolveOrigin(requestUrl) {
  const url = new URL(requestUrl);
  if (url.hostname === 'abdulkerimsesli.de') {
    url.hostname = 'www.abdulkerimsesli.de';
  }
  return url.origin;
}

function toAbsoluteUrl(origin, value) {
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;

  const path = value.startsWith('/') ? value : `/${value}`;
  return `${origin}${path}`;
}

function normalizeText(value, fallback = '') {
  const cleaned = String(value ?? '').trim();
  return cleaned || fallback;
}

function formatSlug(slug = '') {
  return String(slug)
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeXml(unsafe) {
  if (!unsafe) return '';
  return String(unsafe).replace(/[<>&'"]/g, function (c) {
    switch (c) {
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
        return c;
    }
  });
}

function ensureUrlEntry(urlMap, pagePath) {
  const path = normalizePath(pagePath);
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

    addImage(urlMap, `/blog/${encodeURIComponent(id)}/`, {
      loc: toAbsoluteUrl(origin, image),
      title: normalizeText(post.title, `Blog Artikel ${id}`),
      caption: normalizeText(post.excerpt, post.title || id),
      license: LICENSE_URL,
    });
  }
}

function addProjectPreviewImages(urlMap, origin, appsConfig) {
  const apps = Array.isArray(appsConfig?.apps) ? appsConfig.apps : [];
  for (const app of apps) {
    const name = normalizeText(app?.name);
    if (!name) continue;

    addImage(urlMap, '/projekte/', {
      loc: toAbsoluteUrl(
        origin,
        `/content/assets/img/previews/${encodeURIComponent(name)}.svg`,
      ),
      title: normalizeText(app?.title, formatSlug(name)),
      caption: normalizeText(app?.description, formatSlug(name)),
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
        title: normalizeText(title, 'Gallery Image'),
        caption: `${normalizeText(title, 'Gallery Image')} - Abdulkerim Sesli Photography`,
        license: LICENSE_URL,
      });
    }

    cursor = list?.truncated ? list.cursor : undefined;
  } while (cursor);
}

async function loadJsonAsset(context, path) {
  if (!context.env?.ASSETS) return null;

  try {
    const response = await context.env.ASSETS.fetch(
      new URL(path, context.request.url),
    );
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
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
    await addGalleryR2Images(urlMap, context.env?.GALLERY_BUCKET);
  } catch {
    // Keep static + blog + project images even if R2 listing fails.
  }

  const xml = buildXml(origin, urlMap);

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  });
}
