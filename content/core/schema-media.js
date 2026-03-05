import { ENV } from '../config/env.config.js';
import { iconUrl } from '../config/constants.js';
import { normalizeSchemaText as normalizeText } from './schema-shared.js';

export const DEFAULT_IMAGE_DIMENSIONS = Object.freeze({
  width: 1200,
  height: 630,
});

const KNOWN_IMAGE_DIMENSIONS = Object.freeze({
  'favicon-512.webp': { width: 512, height: 512 },
  'og-home-800.png': { width: 800, height: 420 },
  'og-projekte-800.png': { width: 800, height: 420 },
  'og-videos-800.png': { width: 800, height: 420 },
  'og-design-800.png': { width: 800, height: 420 },
  'og-photography-800.png': { width: 800, height: 420 },
  'og-threejs-800.png': { width: 800, height: 420 },
  'og-react-800.png': { width: 800, height: 420 },
  'og-pwa-800.png': { width: 800, height: 420 },
  'og-seo-800.png': { width: 800, height: 420 },
  'og-performance-800.png': { width: 800, height: 420 },
  'og-webcomponents-800.png': { width: 800, height: 420 },
  'og-css-800.png': { width: 800, height: 420 },
  'og-typescript-800.png': { width: 800, height: 420 },
});

export const PERSON_FALLBACK_ICON = iconUrl('favicon-512.webp');

export function toAbsoluteUrl(url, base = ENV.BASE_URL) {
  if (!url) return '';

  try {
    return new URL(url, base).toString();
  } catch {
    return String(url);
  }
}

function getFilename(url) {
  try {
    const parsed = new URL(toAbsoluteUrl(url));
    return parsed.pathname.split('/').pop() || '';
  } catch {
    return '';
  }
}

function inferImageMimeType(url) {
  const filename = getFilename(url).toLowerCase();

  if (filename.endsWith('.svg')) return 'image/svg+xml';
  if (filename.endsWith('.webp')) return 'image/webp';
  if (filename.endsWith('.png')) return 'image/png';
  if (filename.endsWith('.jpg') || filename.endsWith('.jpeg')) {
    return 'image/jpeg';
  }
  if (filename.endsWith('.gif')) return 'image/gif';
  if (filename.endsWith('.avif')) return 'image/avif';
  return null;
}

export function inferImageDimensions(url, fallback = null) {
  const filename = getFilename(url);
  if (filename && KNOWN_IMAGE_DIMENSIONS[filename]) {
    return KNOWN_IMAGE_DIMENSIONS[filename];
  }
  return fallback;
}

function toInt(value) {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function extractYouTubeId(url) {
  try {
    const parsed = new URL(toAbsoluteUrl(url));
    const host = parsed.hostname.toLowerCase();

    if (host === 'youtu.be') {
      return parsed.pathname.replace(/^\/+/, '').split('/')[0] || null;
    }

    if (host.includes('youtube.com') || host.includes('youtube-nocookie.com')) {
      if (parsed.pathname.startsWith('/embed/')) {
        return parsed.pathname.split('/')[2] || null;
      }
      return parsed.searchParams.get('v');
    }
  } catch {
    // Ignore invalid URLs
  }

  return null;
}

export function buildImageObject({
  id,
  imageUrl,
  name,
  caption,
  creatorName,
  currentYear,
  dimensions,
  creditPrefix = 'Photo: ',
  creditText = '',
  representativeOfPage = false,
}) {
  const absoluteUrl = toAbsoluteUrl(imageUrl);
  const encodingFormat = inferImageMimeType(absoluteUrl);

  const imageNode = {
    '@type': 'ImageObject',
    ...(id ? { '@id': id } : {}),
    contentUrl: absoluteUrl,
    url: absoluteUrl,
    name: normalizeText(name || caption || ''),
    caption: normalizeText(caption || name || ''),
    creator: { '@type': 'Person', name: creatorName },
    license: `${ENV.BASE_URL}/#image-license`,
    creditText: normalizeText(creditText || `${creditPrefix}${creatorName}`),
    copyrightNotice: `© ${currentYear} ${creatorName}`,
    acquireLicensePage: `${ENV.BASE_URL}/#image-license`,
  };

  if (encodingFormat) imageNode.encodingFormat = encodingFormat;

  const finalDimensions = dimensions || inferImageDimensions(absoluteUrl);
  if (finalDimensions?.width) imageNode.width = finalDimensions.width;
  if (finalDimensions?.height) imageNode.height = finalDimensions.height;
  if (representativeOfPage) imageNode.representativeOfPage = true;

  return imageNode;
}

export function collectDomImageObjects({
  doc,
  pageUrl,
  brandData,
  currentYear,
  canonicalOrigin,
}) {
  const nodes = [];
  const seen = new Set();
  const images = Array.from(doc?.querySelectorAll?.('main img[src]') || []);

  for (const img of images) {
    if (nodes.length >= 12) break;

    const src = img.getAttribute('src') || img.src;
    if (!src) continue;

    const absolute = toAbsoluteUrl(src, canonicalOrigin);
    if (!absolute || seen.has(absolute)) continue;
    seen.add(absolute);

    const id = `${pageUrl}#image-${nodes.length + 1}`;
    const alt = normalizeText(img.getAttribute('alt') || '');
    const width = toInt(img.getAttribute('width'));
    const height = toInt(img.getAttribute('height'));

    nodes.push(
      buildImageObject({
        id,
        imageUrl: absolute,
        name: alt || pageUrl,
        caption: alt || pageUrl,
        creatorName: brandData.name,
        currentYear,
        dimensions:
          width && height
            ? {
                width,
                height,
              }
            : undefined,
        creditPrefix: brandData.creditPrefix || 'Photo: ',
      }),
    );
  }

  return nodes;
}

export function collectDomVideoObjects({
  doc,
  pageUrl,
  pageData,
  brandData,
  canonicalOrigin,
}) {
  const nodes = [];
  const seen = new Set();

  const iframeVideos = Array.from(
    doc?.querySelectorAll?.('main iframe[src]') || [],
  )
    .filter((iframe) => {
      const src = iframe.getAttribute('src') || iframe.src || '';
      return /youtube\.com|youtube-nocookie\.com|youtu\.be/i.test(src);
    })
    .slice(0, 8);

  for (const iframe of iframeVideos) {
    const src = iframe.getAttribute('src') || iframe.src || '';
    const absoluteEmbed = toAbsoluteUrl(src, canonicalOrigin);
    if (!absoluteEmbed || seen.has(absoluteEmbed)) continue;
    seen.add(absoluteEmbed);

    const youtubeId = extractYouTubeId(absoluteEmbed);
    const canonicalVideoUrl = youtubeId
      ? `https://www.youtube.com/watch?v=${youtubeId}`
      : absoluteEmbed;
    const name = normalizeText(
      iframe.getAttribute('title') ||
        iframe.getAttribute('aria-label') ||
        `${pageData?.title || 'Video'} ${nodes.length + 1}`,
    );

    const videoNode = {
      '@type': 'VideoObject',
      '@id': `${pageUrl}#video-${nodes.length + 1}`,
      name,
      description: normalizeText(pageData?.description || name),
      url: canonicalVideoUrl,
      embedUrl: absoluteEmbed,
      inLanguage: 'de-DE',
      isFamilyFriendly: true,
      publisher: {
        '@type': 'Organization',
        name: brandData.legalName || brandData.name,
        url: ENV.BASE_URL,
      },
    };

    if (youtubeId) {
      videoNode.thumbnailUrl = `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`;
      videoNode.contentUrl = canonicalVideoUrl;
    }

    nodes.push(videoNode);
  }

  const htmlVideos = Array.from(
    doc?.querySelectorAll?.('main video') || [],
  ).slice(0, 8);

  for (const video of htmlVideos) {
    const directSrc =
      video.getAttribute('src') ||
      video.querySelector?.('source[src]')?.getAttribute?.('src') ||
      '';
    if (!directSrc) continue;

    const absoluteSrc = toAbsoluteUrl(directSrc, canonicalOrigin);
    if (!absoluteSrc || seen.has(absoluteSrc)) continue;
    seen.add(absoluteSrc);

    const name = normalizeText(
      video.getAttribute('title') ||
        video.getAttribute('aria-label') ||
        video.getAttribute('data-title') ||
        `${pageData?.title || 'Video'} ${nodes.length + 1}`,
    );

    const videoNode = {
      '@type': 'VideoObject',
      '@id': `${pageUrl}#video-${nodes.length + 1}`,
      name,
      description: normalizeText(pageData?.description || name),
      url: absoluteSrc,
      contentUrl: absoluteSrc,
      inLanguage: 'de-DE',
      isFamilyFriendly: true,
      publisher: {
        '@type': 'Organization',
        name: brandData.legalName || brandData.name,
        url: ENV.BASE_URL,
      },
    };

    const poster = video.getAttribute('poster');
    if (poster) {
      videoNode.thumbnailUrl = toAbsoluteUrl(poster, canonicalOrigin);
    }

    nodes.push(videoNode);
  }

  return nodes;
}
