import {
  formatSlug,
  normalizeText,
  sanitizeDiscoveryText,
} from './_text-utils.js';
import { loadJsonAsset, toISODate } from './_xml-utils.js';
import {
  fetchPlaylistItemsPage,
  fetchUploadsPlaylistId,
  getBestYouTubeThumbnail,
} from './_youtube-utils.js';

export const BLOG_INDEX_PATH = '/pages/blog/posts/index.json';
export const PROJECT_APPS_PATH = '/pages/projekte/apps-config.json';
export const R2_DOMAIN = 'https://img.abdulkerimsesli.de';
export const R2_APP_PREVIEWS_BASE_URL = `${R2_DOMAIN}/app`;
export const APP_PREVIEWS_VERSION = '20260221';
export const MAX_SITEMAP_YOUTUBE_RESULTS = 200;

const GALLERY_PREFIX = 'Gallery/';
const GALLERY_IMAGE_EXT_PATTERN = /\.(jpg|jpeg|png|webp|gif|svg)$/i;

// Keep a small static fallback so image discovery still works without bucket access.
const FALLBACK_GALLERY_KEYS = [
  'Gallery/Mond.webp',
  'Gallery/Urbanes Kaleidoskop.webp',
  'Gallery/Wald-Schienen.webp',
  'Gallery/abdulkerim-sesli-01.webp',
];

function encodePathSegment(value) {
  return encodeURIComponent(String(value || '')).replace(/%2F/g, '/');
}

function formatAppTitle(name, title) {
  return sanitizeDiscoveryText(title, formatSlug(name));
}

function formatAppDescription(name, description) {
  return sanitizeDiscoveryText(description, formatSlug(name));
}

export function buildProjectAppPath(name) {
  return `/projekte/?app=${encodeURIComponent(name)}`;
}

export function buildProjectPreviewImageUrl(name) {
  return `${R2_APP_PREVIEWS_BASE_URL}/${encodeURIComponent(name)}.svg?v=${APP_PREVIEWS_VERSION}`;
}

export function buildBlogPath(id) {
  return `/blog/${encodeURIComponent(id)}/`;
}

export function buildVideoPath(videoId) {
  return `/videos/${encodeURIComponent(videoId)}/`;
}

export function buildYouTubeEmbedUrl(videoId) {
  return `https://www.youtube.com/embed/${encodeURIComponent(videoId)}`;
}

/**
 * Load and normalize project apps from the canonical config.
 * Deduplicates by normalized app name.
 * @param {Object} context - Function context
 * @returns {Promise<Array<{name: string, title: string, description: string, lastmod: string|null}>>}
 */
export async function loadProjectApps(context) {
  const payload = await loadJsonAsset(context, PROJECT_APPS_PATH);
  const rawApps = Array.isArray(payload?.apps) ? payload.apps : [];
  const payloadLastmod = toISODate(payload?.lastUpdated);
  const appsByName = new Map();

  for (const app of rawApps) {
    const name = normalizeText(app?.name);
    if (!name) continue;

    const dedupeKey = name.toLowerCase();
    if (appsByName.has(dedupeKey)) continue;

    appsByName.set(dedupeKey, {
      name,
      title: formatAppTitle(name, app?.title),
      description: formatAppDescription(name, app?.description),
      lastmod: toISODate(app?.lastUpdated) || payloadLastmod || null,
    });
  }

  return [...appsByName.values()];
}

function formatBlogTitle(id, title) {
  return sanitizeDiscoveryText(title, formatSlug(id));
}

function formatBlogDescription(post, fallbackTitle) {
  return sanitizeDiscoveryText(
    post?.seoDescription || post?.excerpt,
    `${fallbackTitle} - Blogbeitrag`,
  );
}

/**
 * Load and normalize blog posts from the canonical index.
 * Deduplicates by normalized post id.
 * @param {Object} context - Function context
 * @returns {Promise<Array<{id: string, title: string, description: string, image: string, lastmod: string|null, keywords: string[]}>>}
 */
export async function loadBlogPosts(context) {
  const payload = await loadJsonAsset(context, BLOG_INDEX_PATH);
  const rawPosts = Array.isArray(payload) ? payload : [];
  const postsById = new Map();

  for (const post of rawPosts) {
    const id = normalizeText(post?.id);
    if (!id) continue;

    const dedupeKey = id.toLowerCase();
    if (postsById.has(dedupeKey)) continue;

    const title = formatBlogTitle(id, post?.title);
    const description = formatBlogDescription(post, title);
    const keywords = Array.isArray(post?.keywords)
      ? post.keywords.map((keyword) => normalizeText(keyword)).filter(Boolean)
      : String(post?.keywords || '')
          .split(',')
          .map((keyword) => normalizeText(keyword))
          .filter(Boolean);

    postsById.set(dedupeKey, {
      id,
      title,
      description,
      image: normalizeText(post?.image),
      lastmod: toISODate(post?.date) || null,
      keywords,
    });
  }

  return [...postsById.values()];
}

function toGalleryImageRecord(objectLike) {
  const key = normalizeText(objectLike?.key);
  if (!key || !GALLERY_IMAGE_EXT_PATTERN.test(key)) return null;

  const filename = key.split('/').pop() || key;
  const title = sanitizeDiscoveryText(formatSlug(filename), 'Gallery Image');

  return {
    key,
    loc: `${R2_DOMAIN}/${encodePathSegment(key)}`,
    title,
    caption: `${title} - Fotoinhalt aus der Bildgalerie von Abdulkerim Sesli`,
    lastmod: toISODate(objectLike?.uploaded) || null,
  };
}

async function listGalleryObjects(bucket) {
  if (!bucket) return [];

  const objects = [];
  let cursor;

  do {
    const list = await bucket.list({ prefix: GALLERY_PREFIX, cursor });
    objects.push(...(Array.isArray(list?.objects) ? list.objects : []));
    cursor = list?.truncated ? list.cursor : undefined;
  } while (cursor);

  return objects;
}

/**
 * Load gallery images from R2 and merge with static fallback keys.
 * Deduplicates by final image URL.
 * @param {Object} context - Function context
 * @returns {Promise<Array<{key: string, loc: string, title: string, caption: string, lastmod: string|null}>>}
 */
export async function loadGalleryImages(context) {
  let dynamicObjects = [];

  try {
    dynamicObjects = await listGalleryObjects(context.env?.GALLERY_BUCKET);
  } catch {}

  const fallbackObjects = FALLBACK_GALLERY_KEYS.map((key) => ({
    key,
    uploaded: null,
  }));

  const allImageRecords = [...dynamicObjects, ...fallbackObjects]
    .map((entry) => toGalleryImageRecord(entry))
    .filter(Boolean);

  const imageByLoc = new Map();
  for (const image of allImageRecords) {
    if (imageByLoc.has(image.loc)) continue;
    imageByLoc.set(image.loc, image);
  }

  return [...imageByLoc.values()].sort((a, b) =>
    a.loc.localeCompare(b.loc, 'en'),
  );
}

/**
 * Load and normalize YouTube videos from channel uploads playlist.
 * Deduplicates by video id.
 * @param {Object} env - Function env
 * @param {number} [maxResults=MAX_SITEMAP_YOUTUBE_RESULTS] - Max video items
 * @returns {Promise<Array<{videoId: string, path: string, title: string, description: string, thumbnail: string, channelTitle: string, publishedAt: string, lastmod: string|null}>>}
 */
export async function loadYouTubeVideos(
  env,
  maxResults = MAX_SITEMAP_YOUTUBE_RESULTS,
) {
  const channelId = normalizeText(env?.YOUTUBE_CHANNEL_ID);
  const apiKey = normalizeText(env?.YOUTUBE_API_KEY);
  if (!channelId || !apiKey) return [];

  const uploadsPlaylistId = await fetchUploadsPlaylistId(channelId, apiKey);
  if (!uploadsPlaylistId) return [];

  const videosById = new Map();
  let nextPageToken = null;
  let collected = 0;

  do {
    const payload = await fetchPlaylistItemsPage(
      uploadsPlaylistId,
      apiKey,
      nextPageToken,
    );
    const items = Array.isArray(payload?.items) ? payload.items : [];

    for (const item of items) {
      const snippet = item?.snippet || {};
      const videoId = normalizeText(snippet?.resourceId?.videoId);
      if (!videoId) continue;
      if (videosById.has(videoId)) continue;

      const title = sanitizeDiscoveryText(snippet?.title, `Video ${videoId}`);
      const description = sanitizeDiscoveryText(
        snippet?.description,
        `${title} - Videoinhalt von Abdulkerim Sesli`,
      );
      const publishedAt = normalizeText(snippet?.publishedAt);
      const channelTitle = sanitizeDiscoveryText(
        snippet?.channelTitle,
        'Abdulkerim Sesli',
      );

      videosById.set(videoId, {
        videoId,
        path: buildVideoPath(videoId),
        title,
        description,
        thumbnail: getBestYouTubeThumbnail(snippet),
        channelTitle,
        publishedAt,
        lastmod: toISODate(publishedAt),
      });

      collected += 1;
      if (collected >= maxResults) {
        return [...videosById.values()];
      }
    }

    nextPageToken = payload?.nextPageToken || null;
  } while (nextPageToken && collected < maxResults);

  return [...videosById.values()];
}
