import { escapeXml, resolveOrigin } from './api/_xml-utils.js';
import {
  buildYouTubeEmbedUrl,
  loadYouTubeVideos,
} from './api/_sitemap-data.js';
import {
  buildSitemapHeaders,
  loadSitemapSnapshot,
  respondWithSnapshotOr503,
  saveSitemapSnapshot,
} from './api/_sitemap-snapshot.js';

const CACHE_CONTROL = 'public, max-age=3600, stale-while-revalidate=86400';
const SNAPSHOT_NAME = 'sitemap-videos.xml';

function toVideoNode(video, channelId) {
  if (!video?.videoId || !video?.thumbnail) return '';

  const uploader = escapeXml(video.channelTitle || 'Abdulkerim Sesli');
  const publicationDate = video.publishedAt || '';
  const publicationNode = publicationDate
    ? `\n      <video:publication_date>${escapeXml(publicationDate)}</video:publication_date>`
    : '';

  return `  <url>
    <loc>${escapeXml(video.path)}</loc>
    <video:video>
      <video:thumbnail_loc>${escapeXml(video.thumbnail)}</video:thumbnail_loc>
      <video:title>${escapeXml(video.title || `Video ${video.videoId}`)}</video:title>
      <video:description>${escapeXml(video.description || `Video ${video.videoId}`)}</video:description>
      <video:player_loc allow_embed="yes" autoplay="ap=1">${escapeXml(buildYouTubeEmbedUrl(video.videoId))}</video:player_loc>${publicationNode}
      <video:family_friendly>yes</video:family_friendly>
      <video:requires_subscription>no</video:requires_subscription>
      <video:uploader info="https://www.youtube.com/channel/${escapeXml(channelId)}">${uploader}</video:uploader>
      <video:live>no</video:live>
    </video:video>
  </url>`;
}

function buildFallbackXml(origin) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
  <url>
    <loc>${escapeXml(`${origin}/videos/`)}</loc>
  </url>
</urlset>`;
}

export async function onRequest(context) {
  const origin = resolveOrigin(context.request.url);
  const channelId = String(context.env?.YOUTUBE_CHANNEL_ID || '').trim();
  const apiKey = String(context.env?.YOUTUBE_API_KEY || '').trim();

  if (!channelId || !apiKey) {
    const snapshot = await loadSitemapSnapshot(context.env, SNAPSHOT_NAME);
    if (snapshot?.xml) {
      return new Response(snapshot.xml, {
        status: 200,
        headers: buildSitemapHeaders(CACHE_CONTROL, {
          'X-Sitemap-Source': 'snapshot-stale',
          ...(snapshot.updatedAt
            ? { 'X-Sitemap-Snapshot-At': snapshot.updatedAt }
            : {}),
        }),
      });
    }

    return new Response(buildFallbackXml(origin), {
      headers: {
        ...buildSitemapHeaders(CACHE_CONTROL),
        'X-Sitemap-Source': 'fallback-no-credentials',
      },
    });
  }

  try {
    const videos = await loadYouTubeVideos(context.env);
    if (!videos.length) {
      const snapshot = await loadSitemapSnapshot(context.env, SNAPSHOT_NAME);
      if (snapshot?.xml) {
        return new Response(snapshot.xml, {
          status: 200,
          headers: buildSitemapHeaders(CACHE_CONTROL, {
            'X-Sitemap-Source': 'snapshot-stale',
            ...(snapshot.updatedAt
              ? { 'X-Sitemap-Snapshot-At': snapshot.updatedAt }
              : {}),
          }),
        });
      }

      return new Response(buildFallbackXml(origin), {
        headers: {
          ...buildSitemapHeaders(CACHE_CONTROL),
          'X-Sitemap-Source': 'fallback-empty-video-feed',
        },
      });
    }

    const seenPaths = new Set();
    const uniqueVideos = [];
    for (const video of videos) {
      const absolutePath = `${origin}${video.path}`;
      if (seenPaths.has(absolutePath)) continue;
      seenPaths.add(absolutePath);
      uniqueVideos.push({
        ...video,
        path: absolutePath,
      });
    }

    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
      '        xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">',
      ...uniqueVideos
        .map((video) => toVideoNode(video, channelId))
        .filter(Boolean),
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
