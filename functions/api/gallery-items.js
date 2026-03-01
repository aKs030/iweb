// Memory cache for R2 objects to reduce costs and latency
let cachedObjects = null;
let cacheExpiresAt = 0;
let pendingLoadPromise = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function onRequest(context) {
  const { env, request } = context;
  const url = new URL(request.url);

  const BUCKET = env.GALLERY_BUCKET;
  if (!BUCKET) {
    return new Response(
      JSON.stringify({ error: 'Gallery Bucket not configured' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }

  // Optimize: Use Cloudflare Cache API for persistent caching across worker restarts
  const cache = caches.default;
  const isLocal = url.hostname === 'localhost' || url.hostname === '127.0.0.1';

  // Try fetching from cache first (skip for local dev to avoid confusion)
  if (!isLocal) {
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      // Add a header to indicate cache hit for debugging
      const hitResponse = new Response(cachedResponse.body, cachedResponse);
      hitResponse.headers.set('X-Cache', 'HIT');
      return hitResponse;
    }
  }

  try {
    let objects = [];
    const now = Date.now();

    // Secondary layer: In-memory cache for ultra-fast same-isolate hits
    if (cachedObjects && now < cacheExpiresAt) {
      objects = cachedObjects;
    } else {
      // De-duplication: Check if another request is already fetching from R2
      if (pendingLoadPromise) {
        objects = await pendingLoadPromise;
      } else {
        // Fetch from R2 and update in-memory cache
        pendingLoadPromise = (async () => {
          try {
            const listResults = [];
            let cursor;

            do {
              const list = await BUCKET.list({ prefix: 'Gallery/', cursor });
              if (list.objects) {
                listResults.push(...list.objects);
              }
              cursor = list.truncated ? list.cursor : undefined;
            } while (cursor);

            const filtered = listResults
              .filter((obj) =>
                /\.(jpg|jpeg|png|webp|gif|svg|mp4|webm)$/i.test(obj.key),
              )
              .map((obj) => ({
                ...obj,
                uploadedTime: new Date(obj.uploaded).getTime(),
              }));

            filtered.sort((a, b) => b.uploadedTime - a.uploadedTime);

            cachedObjects = filtered;
            cacheExpiresAt = Date.now() + CACHE_TTL_MS;
            return filtered;
          } finally {
            pendingLoadPromise = null;
          }
        })();

        objects = await pendingLoadPromise;
      }
    }

    const R2_BASE = isLocal ? '/r2-proxy' : 'https://img.abdulkerimsesli.de';

    const items = objects.map((obj) => {
      const key = obj.key;
      const filename = key.split('/').pop();
      const type = /\.(mp4|webm)$/i.test(filename) ? 'video' : 'image';
      const title = filename.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');

      return {
        id: key,
        type: type,
        url: `${R2_BASE}/${encodeURIComponent(key).replace(/%2F/g, '/')}`,
        title: title,
        description: `Taken by Abdulkerim Sesli`,
        size: obj.size,
        uploaded: obj.uploaded,
      };
    });

    const responseContent = JSON.stringify({ items });
    const responseView = new Response(responseContent, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1200',
        'Access-Control-Allow-Origin': 'https://www.abdulkerimsesli.de',
        'X-Cache': 'MISS',
      },
    });

    // Store in Cache API if not local
    if (!isLocal) {
      context.waitUntil(cache.put(request, responseView.clone()));
    }

    return responseView;
  } catch (err) {
    console.error('Gallery API error:', err);
    return new Response(JSON.stringify({ error: 'Gallery request failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
