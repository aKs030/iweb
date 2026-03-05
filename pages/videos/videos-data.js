import { ENV } from '#config/env.config.js';
import { createLogger } from '#core/logger.js';
import { isLocalDevRuntime } from '#core/runtime-env.js';
import {
  fetchUploadsPlaylist,
  fetchPlaylistItems,
  searchChannelVideos,
  fetchVideoDetailsMap,
} from './services/youtube-api.service.js';

const log = createLogger('videos-data');
const YOUTUBE_CHANNEL_ID = ENV.YOUTUBE_CHANNEL_ID || 'UCTGRherjM4iuIn86xxubuPg';

export async function loadFromApi(options = {}) {
  const channelId = YOUTUBE_CHANNEL_ID;
  if (!channelId) {
    log.error('No YouTube channel ID configured');
    return { items: [], detailsMap: {} };
  }

  const notifyInfo =
    typeof options.notifyInfo === 'function' ? options.notifyInfo : null;

  const uploads = await fetchUploadsPlaylist(channelId);
  let items;

  if (uploads) {
    items = await fetchPlaylistItems(uploads);
    if (items.length === 0) {
      if (isLocalDevRuntime()) {
        log.info(
          'Uploads playlist returned no items in local dev — falling back to search',
        );
      } else {
        log.warn('Uploads playlist returned no items — falling back to search');
      }
      notifyInfo?.(
        'Uploads playlist leer — lade Videos per Suche als Fallback.',
      );
      items = await searchChannelVideos(channelId);
    }
  } else {
    if (isLocalDevRuntime()) {
      log.info(
        'No uploads playlist available in local dev — falling back to search',
      );
    } else {
      log.warn('No uploads playlist available — falling back to search');
    }
    notifyInfo?.(
      'Uploads playlist nicht vorhanden — lade Videos per Suche als Fallback.',
    );
    items = await searchChannelVideos(channelId);
  }

  if (!items.length) return { items: [], detailsMap: {} };

  const vidIds = items
    .map((item) => item.snippet.resourceId.videoId)
    .filter(Boolean);
  const detailsMap = await fetchVideoDetailsMap(vidIds);
  return { items, detailsMap };
}

export async function ensureDeepLinkedVideo(options = {}) {
  const videoId = String(options.videoId || '').trim();
  const items = Array.isArray(options.items) ? [...options.items] : [];
  const detailsMap =
    options.detailsMap && typeof options.detailsMap === 'object'
      ? { ...options.detailsMap }
      : {};

  if (!videoId) return { items, detailsMap };

  const exists = items.some(
    (item) => item.snippet?.resourceId?.videoId === videoId,
  );
  if (exists) {
    return { items, detailsMap };
  }

  try {
    const extraMap = await fetchVideoDetailsMap([videoId]);
    const detail = extraMap[videoId];
    if (detail && detail.snippet) {
      items.unshift({
        snippet: {
          resourceId: { videoId },
          title: detail.snippet.title,
          description: detail.snippet.description,
          thumbnails: detail.snippet.thumbnails,
          publishedAt: detail.snippet.publishedAt,
        },
      });
      detailsMap[videoId] = detail;
    }
  } catch (error) {
    log.warn('Could not fetch deep-linked video', error);
  }

  return { items, detailsMap };
}
