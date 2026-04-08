import { enrichGalleryObject } from '../_shared/gallery-media.js';
import { isGalleryMediaPath } from '../_shared/media-assets.js';

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const GALLERY_PREFIX = 'Gallery/';

let cachedObjects = null;
let cacheExpiresAt = 0;
let pendingLoadPromise = null;

async function listGalleryObjects(bucket) {
  const listResults = [];
  let cursor;

  do {
    const list = await bucket.list({ prefix: GALLERY_PREFIX, cursor });
    if (list.objects) {
      listResults.push(...list.objects);
    }
    cursor = list.truncated ? list.cursor : undefined;
  } while (cursor);

  return listResults;
}

/**
 * @param {R2Bucket} bucket
 * @returns {Promise<any[]>}
 */
export async function listGalleryObjectsWithMetadata(bucket) {
  const now = Date.now();

  if (cachedObjects && now < cacheExpiresAt) {
    return cachedObjects;
  }

  if (pendingLoadPromise) {
    return pendingLoadPromise;
  }

  pendingLoadPromise = (async () => {
    try {
      const listResults = await listGalleryObjects(bucket);
      const filtered = listResults
        .filter((obj) => isGalleryMediaPath(obj.key))
        .map((obj) => ({
          ...obj,
          uploadedTime: new Date(obj.uploaded).getTime(),
        }));

      filtered.sort((a, b) => b.uploadedTime - a.uploadedTime);

      const enrichedObjects = await Promise.all(
        filtered.map((obj) => enrichGalleryObject(bucket, obj)),
      );

      cachedObjects = enrichedObjects;
      cacheExpiresAt = Date.now() + CACHE_TTL_MS;
      return enrichedObjects;
    } finally {
      pendingLoadPromise = null;
    }
  })();

  return pendingLoadPromise;
}
