import assert from "node:assert/strict";
import { loadFromApi } from "../pages/videos/videos.js";

console.log("Running loadFromApi tests...");

// Mock global fetch to respond depending on URL
const origFetch = globalThis.fetch;
function makeFetchResponder(mapping) {
  return async (url) => {
    const key = Object.keys(mapping).find((k) => url.includes(k));
    if (!key) return { ok: false, status: 404, statusText: 'Not Found', text: async () => '' };
    const body = mapping[key];
    return {
      ok: true,
      json: async () => body,
      text: async () => JSON.stringify(body),
    };
  };
}

(async () => {
  // 1) Successful flow
  globalThis.fetch = makeFetchResponder({
    'youtube/v3/search': { items: [{ snippet: { channelId: 'C1' } }] },
    'youtube/v3/channels': { items: [{ contentDetails: { relatedPlaylists: { uploads: 'PL1' } } }] },
    'youtube/v3/playlistItems': { items: [{ snippet: { resourceId: { videoId: 'v1' } } }] },
    'youtube/v3/videos': { items: [{ id: 'v1', statistics: { viewCount: '10' }, contentDetails: { duration: 'PT1M' } }] },
  });

  const res = await loadFromApi('APIKEY', 'handle');
  assert.ok(res.items && Array.isArray(res.items), 'items array');
  assert.strictEqual(res.items.length, 1, 'one item');
  assert.ok(res.detailsMap && res.detailsMap.v1, 'detailsMap contains v1');

  console.log('loadFromApi success test passed');

  // 2) Missing channel -> returns empty
  globalThis.fetch = makeFetchResponder({
    'youtube/v3/search': { items: [] },
  });
  const res2 = await loadFromApi('APIKEY', 'handle');
  assert.ok(res2.items.length === 0, 'no items');
  assert.deepStrictEqual(res2.detailsMap, {}, 'empty details map');
  console.log('loadFromApi missing channel test passed');

  // 3) uploads playlist missing -> fallback to search
  globalThis.fetch = makeFetchResponder({
    'youtube/v3/search?part=snippet&type=channel': { items: [{ snippet: { channelId: 'C1' } }] },
    'youtube/v3/search?part=snippet&channelId=': { items: [{ id: { videoId: 'v2' }, snippet: { title: 't2', description: 'd2', thumbnails: {}, publishedAt: '2025-01-01' } }] },
    'youtube/v3/channels': { items: [{ contentDetails: { relatedPlaylists: { uploads: null } } }] },
    'youtube/v3/videos': { items: [{ id: 'v2', statistics: { viewCount: '5' }, contentDetails: { duration: 'PT2M' } }] },
  });
  const res3 = await loadFromApi('APIKEY', 'handle');
  assert.ok(res3.items.length === 1 && res3.items[0].snippet.resourceId.videoId === 'v2', 'fallback search returns v2');
  assert.ok(res3.detailsMap && res3.detailsMap.v2, 'detailsMap contains v2');
  console.log('loadFromApi uploads-missing fallback test passed');

  // 4) uploads playlist present but empty -> fallback to search
  globalThis.fetch = makeFetchResponder({
    'youtube/v3/search?part=snippet&type=channel': { items: [{ snippet: { channelId: 'C1' } }] },
    'youtube/v3/search?part=snippet&channelId=': { items: [{ id: { videoId: 'v3' }, snippet: { title: 't3', description: 'd3', thumbnails: {}, publishedAt: '2025-01-02' } }] },
    'youtube/v3/channels': { items: [{ contentDetails: { relatedPlaylists: { uploads: 'PL_EMPTY' } } }] },
    'youtube/v3/playlistItems': { items: [] },
    'youtube/v3/videos': { items: [{ id: 'v3', statistics: { viewCount: '2' }, contentDetails: { duration: 'PT3M' } }] },
  });
  const res4 = await loadFromApi('APIKEY', 'handle');
  assert.ok(res4.items.length === 1 && res4.items[0].snippet.resourceId.videoId === 'v3', 'fallback search returns v3 when playlist empty');
  assert.ok(res4.detailsMap && res4.detailsMap.v3, 'detailsMap contains v3');
  console.log('loadFromApi empty-playlist fallback test passed');

  // 5) explicit YOUTUBE_CHANNEL_ID should be used directly
  globalThis.YOUTUBE_CHANNEL_ID = 'C_EXPLICIT';
  globalThis.fetch = makeFetchResponder({
    'youtube/v3/channels?part=contentDetails&id=C_EXPLICIT': { items: [{ contentDetails: { relatedPlaylists: { uploads: 'PL_EX' } } }] },
    'youtube/v3/playlistItems': { items: [{ snippet: { resourceId: { videoId: 'vx' } } }] },
    'youtube/v3/videos': { items: [{ id: 'vx', statistics: { viewCount: '1' }, contentDetails: { duration: 'PT1M' } }] },
  });
  const res5 = await loadFromApi('APIKEY', 'handle');
  assert.ok(res5.items.length === 1 && res5.items[0].snippet.resourceId.videoId === 'vx', 'explicit channel id returns vx');
  assert.ok(res5.detailsMap && res5.detailsMap.vx, 'detailsMap contains vx');
  delete globalThis.YOUTUBE_CHANNEL_ID;
  console.log('loadFromApi explicit-channel-id test passed');

  globalThis.fetch = origFetch;
  console.log('loadFromApi tests done');
})();