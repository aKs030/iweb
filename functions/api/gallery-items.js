// Memory cache for R2 objects to reduce costs and latency
let cachedObjects = null;
let cacheExpiresAt = 0;
let pendingLoadPromise = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function onRequest(context) {
  const { env } = context;
  const url = new URL(context.request.url);

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

  try {
    let objects = [];
    const now = Date.now();

    // Check if we have a valid cache
    if (cachedObjects && now < cacheExpiresAt) {
      objects = cachedObjects;
    } else {
      // Check if another request is already fetching from R2
      if (pendingLoadPromise) {
        objects = await pendingLoadPromise;
      } else {
        // Fetch from R2 and update cache
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

            cachedObjects = listResults;
            cacheExpiresAt = Date.now() + CACHE_TTL_MS;
            return listResults;
          } finally {
            pendingLoadPromise = null;
          }
        })();

        objects = await pendingLoadPromise;
      }
    }

    // Base URL for images
    // Use environment variable or default to custom domain
    // During local dev, use relative proxy path
    const isLocal =
      url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    const R2_BASE = isLocal ? '/r2-proxy' : 'https://img.abdulkerimsesli.de';

    const items = objects
      .filter((obj) => /\.(jpg|jpeg|png|webp|gif|svg|mp4|webm)$/i.test(obj.key))
      .map((obj) => {
        const key = obj.key;
        const filename = key.split('/').pop();
        const type = /\.(mp4|webm)$/i.test(filename) ? 'video' : 'image';

        // "Gallery/My Image.jpg" -> "My Image"
        const title = filename.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');

        return {
          id: key, // Unique ID
          type: type,
          url: `${R2_BASE}/${encodeURIComponent(key).replace(/%2F/g, '/')}`,
          title: title,
          description: `Taken by Abdulkerim Sesli`, // Default description
          size: obj.size,
          uploaded: obj.uploaded,
        };
      });

    // Sort by upload date (newest first)
    items.sort((a, b) => new Date(b.uploaded) - new Date(a.uploaded));

    return new Response(JSON.stringify({ items }), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=600', // Cache 10 minutes
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
