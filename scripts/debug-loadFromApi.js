import { loadFromApi } from '../pages/videos/videos.js';
(async () => {
  const mapping = {
    'youtube/v3/search?part=snippet&type=channel': { items: [{ snippet: { channelId: 'C1' } }] },
    'youtube/v3/search?part=snippet&channelId=': { items: [{ id: { videoId: 'v3' }, snippet: { title: 't3', description: 'd3', thumbnails: {}, publishedAt: '2025-01-02' } }] },
    'youtube/v3/channels': { items: [{ contentDetails: { relatedPlaylists: { uploads: 'PL_EMPTY' } } }] },
    'youtube/v3/playlistItems': { items: [] },
    'youtube/v3/videos': { items: [{ id: 'v3', statistics: { viewCount: '2' }, contentDetails: { duration: 'PT3M' } }] },
  };
  global.fetch = async (url) => {
    console.log('MOCK FETCH URL:', url);
    const key = Object.keys(mapping).find((k) => url.includes(k));
    console.log('MATCH KEY:', key);
    if (!key) return { ok: false, status: 404, statusText: 'Not Found', text: async () => '' };
    const body = mapping[key];
    return { ok: true, json: async () => body, text: async () => JSON.stringify(body) };
  };

  const res = await loadFromApi('APIKEY', 'handle');
  console.log('RESULT:', JSON.stringify(res, null, 2));
})();