import { isLocalDevRuntime } from '../../content/core/runtime-env.js';
import { jsonResponse, errorJsonResponse } from './_response.js';
import { listGalleryObjectsWithMetadata } from './_gallery-service.js';
import { buildGalleryItemPayload } from '../_shared/gallery-media.js';

export async function onRequest(context) {
  const { env, request } = context;
  const url = new URL(request.url);

  const BUCKET = env.GALLERY_BUCKET;
  if (!BUCKET) {
    return errorJsonResponse('Gallery Bucket not configured', {
      status: 500,
    });
  }

  // Optimize: Use Cloudflare Cache API for persistent caching across worker restarts
  const cache = caches.default;
  const isLocal = isLocalDevRuntime(url);

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
    const objects = await listGalleryObjectsWithMetadata(BUCKET);
    const items = objects.map((obj) => buildGalleryItemPayload(obj, url));

    const responseView = jsonResponse(
      { items },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1200',
          'Access-Control-Allow-Origin': 'https://www.abdulkerimsesli.de',
          'X-Cache': 'MISS',
        },
      },
    );

    // Store in Cache API if not local
    if (!isLocal) {
      context.waitUntil(cache.put(request, responseView.clone()));
    }

    return responseView;
  } catch (err) {
    console.error('Gallery API error:', err);
    return errorJsonResponse('Gallery request failed', {
      status: 500,
    });
  }
}
