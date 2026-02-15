/**
 * YouTube API Service
 * Centralized YouTube API interactions
 * @version 1.0.0
 */

import { createLogger } from '/content/core/logger.js';
import { fetchJSON } from '/content/core/fetch.js';

const log = createLogger('YouTubeAPI');

/**
 * Fetch uploads playlist ID for a channel
 * @param {string} channelId - YouTube channel ID
 * @returns {Promise<string|null>} - Uploads playlist ID or null
 */
export const fetchUploadsPlaylist = async (channelId) => {
  const url = `/api/youtube/channels?part=contentDetails&id=${channelId}`;
  const json = await fetchJSON(url);
  return json?.items?.[0]?.contentDetails?.relatedPlaylists?.uploads || null;
};

/**
 * Fetch all items from a playlist with pagination
 * @param {string} playlistId - YouTube playlist ID
 * @param {Function|null} [onProgress] - Progress callback (progress, message)
 * @param {number} maxResults - Max results per page
 * @returns {Promise<Array>} - Array of playlist items
 */
export const fetchPlaylistItems = async (
  playlistId,
  onProgress = null,
  maxResults = 50,
) => {
  const allItems = [];
  let pageToken = '';
  let page = 0;

  do {
    const url = `/api/youtube/playlistItems?part=snippet&playlistId=${playlistId}&maxResults=${maxResults}${
      pageToken ? `&pageToken=${pageToken}` : ''
    }`;

    try {
      const json = await fetchJSON(url);
      allItems.push(...(json.items || []));
      pageToken = json.nextPageToken;
      page++;

      if (onProgress) {
        const progress = pageToken ? 0.5 : 1;
        onProgress(progress, `Lade Videos (Seite ${page})...`);
      }
    } catch (e) {
      if (
        e?.status === 404 &&
        /playlistNotFound|playlistId/.test(e?.body || '')
      ) {
        log.warn(`Uploads playlist not found: ${playlistId}`);
        return [];
      }
      throw e;
    }
  } while (pageToken);

  return allItems;
};

/**
 * Search for videos in a channel (fallback method)
 * @param {string} channelId - YouTube channel ID
 * @param {number} maxResults - Max results per page
 * @returns {Promise<Array>} - Array of video items
 */
export const searchChannelVideos = async (channelId, maxResults = 50) => {
  const items = [];
  let pageToken = '';

  do {
    const url = `/api/youtube/search?part=snippet&channelId=${channelId}&order=date&type=video&maxResults=${maxResults}${
      pageToken ? `&pageToken=${pageToken}` : ''
    }`;

    try {
      const json = await fetchJSON(url);
      (json.items || []).forEach((it) => {
        if (it?.id?.videoId) {
          items.push({
            snippet: {
              resourceId: { videoId: it.id.videoId },
              title: it.snippet.title,
              description: it.snippet.description,
              thumbnails: it.snippet.thumbnails,
              publishedAt: it.snippet.publishedAt,
            },
          });
        }
      });
      pageToken = json.nextPageToken;
    } catch (e) {
      log.warn('searchChannelVideos failed:', e);
      return items;
    }
  } while (pageToken);

  return items;
};

/**
 * Fetch detailed information for multiple videos
 * @param {Array<string>} videoIds - Array of video IDs
 * @returns {Promise<Object>} - Map of video ID to video details
 */
export const fetchVideoDetailsMap = async (videoIds) => {
  const map = {};
  if (!videoIds.length) return map;

  const url = `/api/youtube/videos?part=snippet,contentDetails,statistics&id=${videoIds.join(
    ',',
  )}`;

  try {
    const json = await fetchJSON(url);
    (json.items || []).forEach((v) => {
      if (v.id) {
        map[v.id] = v;
      }
    });
  } catch (e) {
    log.warn('Could not fetch video details:', e);
  }

  return map;
};
