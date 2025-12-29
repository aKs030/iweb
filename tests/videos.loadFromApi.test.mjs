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

  globalThis.fetch = origFetch;
  console.log('loadFromApi tests done');
})();