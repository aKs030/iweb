/**
 * YouTube API Utilities - Shared YouTube integration functions
 * @version 1.0.0
 */

/**
 * Fetch YouTube uploads playlist ID
 * @param {string} channelId - YouTube channel ID
 * @param {string} apiKey - YouTube API key
 * @returns {Promise<string|null>} Uploads playlist ID or null
 */
export async function fetchUploadsPlaylistId(channelId, apiKey) {
  const channelUrl = new URL('https://www.googleapis.com/youtube/v3/channels');
  channelUrl.searchParams.set('id', channelId);
  channelUrl.searchParams.set('key', apiKey);
  channelUrl.searchParams.set('part', 'contentDetails');

  const response = await fetch(channelUrl.toString());
  if (!response.ok) {
    throw new Error(`YouTube channels API failed: ${response.status}`);
  }

  const payload = await response.json();
  const firstItem = payload?.items?.[0];
  return firstItem?.contentDetails?.relatedPlaylists?.uploads || null;
}

/**
 * Fetch one page of videos from a YouTube playlist
 * @param {string} playlistId - YouTube playlist ID
 * @param {string} apiKey - YouTube API key
 * @param {string|null} pageToken - Optional page token
 * @returns {Promise<Object>} Playlist page payload
 */
export async function fetchPlaylistItemsPage(
  playlistId,
  apiKey,
  pageToken = null,
) {
  const playlistUrl = new URL(
    'https://www.googleapis.com/youtube/v3/playlistItems',
  );
  playlistUrl.searchParams.set('playlistId', playlistId);
  playlistUrl.searchParams.set('key', apiKey);
  playlistUrl.searchParams.set('part', 'snippet');
  playlistUrl.searchParams.set('maxResults', '50');
  if (pageToken) {
    playlistUrl.searchParams.set('pageToken', pageToken);
  }

  const response = await fetch(playlistUrl.toString());
  if (!response.ok) {
    throw new Error(`YouTube playlistItems API failed: ${response.status}`);
  }

  return response.json();
}

/**
 * Convert to YouTube date format
 * @param {string} value - Date value
 * @param {string} fallbackDate - Fallback date
 * @returns {string} ISO date string
 */
export function toYoutubeDate(value, fallbackDate) {
  const parsed = new Date(value || '');
  if (Number.isNaN(parsed.getTime())) return fallbackDate;
  return parsed.toISOString().split('T')[0];
}

/**
 * Get best quality YouTube thumbnail
 * @param {Object} snippet - YouTube video snippet
 * @returns {string} Thumbnail URL
 */
export function getBestYouTubeThumbnail(snippet = {}) {
  return (
    snippet.thumbnails?.maxres?.url ||
    snippet.thumbnails?.standard?.url ||
    snippet.thumbnails?.high?.url ||
    snippet.thumbnails?.medium?.url ||
    snippet.thumbnails?.default?.url ||
    ''
  );
}
