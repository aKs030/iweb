import {
  escapeXml,
  normalizePath,
  resolveOrigin,
  toAbsoluteUrl,
} from './api/_xml-utils.js';
import {
  buildSitemapHeaders,
  respondWithSnapshotOr503,
  saveSitemapSnapshot,
} from './api/_sitemap-snapshot.js';
import { normalizeText, sanitizeDiscoveryText } from './api/_text-utils.js';
import {
  buildBlogPath,
  buildProjectAppPath,
  buildProjectPreviewImageUrl,
  loadBlogPosts,
  loadGalleryImages,
  loadProjectApps,
  loadYouTubeVideos,
} from './api/_sitemap-data.js';

const LICENSE_URL = 'https://www.abdulkerimsesli.de/#image-license';
const CACHE_CONTROL = 'public, max-age=3600, stale-while-revalidate=86400';
const SNAPSHOT_NAME = 'sitemap-images.xml';

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
  const imageLoc = normalizeText(image?.loc);
  if (!imageLoc) return;

  // Keep each image URL unique per <url> entry while allowing
  // cross-page reuse (same image on overview + detail pages).
  const exists = images.some((existing) => existing.loc === imageLoc);
  if (exists) return;

  images.push({
    ...image,
    loc: imageLoc,
  });
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
      post.description,
      `${cleanTitle || id} - Blogbeitrag mit Bildern, Codebeispielen und Kontext`,
    );

    addImage(urlMap, buildBlogPath(id), {
      loc: toAbsoluteUrl(origin, image),
      title: cleanTitle,
      caption: cleanCaption,
      license: LICENSE_URL,
    });
  }
}

function addProjectPreviewImages(urlMap, apps) {
  for (const app of apps) {
    const name = normalizeText(app?.name);
    if (!name) continue;

    addImage(urlMap, buildProjectAppPath(name), {
      loc: buildProjectPreviewImageUrl(name),
      title: app.title,
      caption: app.description,
      license: LICENSE_URL,
    });
  }
}

function addGalleryImages(urlMap, images) {
  for (const image of images) {
    addImage(urlMap, '/gallery/', {
      loc: image.loc,
      title: image.title,
      caption: image.caption,
      license: LICENSE_URL,
    });
  }
}

function addYouTubeVideoImages(urlMap, videos) {
  for (const video of videos) {
    if (!video?.videoId || !video?.thumbnail) continue;

    addImage(urlMap, video.path, {
      loc: video.thumbnail,
      title: video.title,
      caption: video.description,
    });
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
  try {
    const origin = resolveOrigin(context.request.url);
    const urlMap = new Map();

    addStaticImages(urlMap, origin);

    const [posts, apps, galleryImages, videos] = await Promise.all([
      loadBlogPosts(context),
      loadProjectApps(context),
      loadGalleryImages(context),
      loadYouTubeVideos(context.env),
    ]);

    addBlogImages(urlMap, origin, posts);
    addProjectPreviewImages(urlMap, apps);
    addGalleryImages(urlMap, galleryImages);
    addYouTubeVideoImages(urlMap, videos);

    const xml = buildXml(origin, urlMap);

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
