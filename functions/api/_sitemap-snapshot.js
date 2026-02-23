/**
 * Sitemap snapshot utilities (stale-if-error)
 *
 * Storage:
 * Dedicated KV binding: SITEMAP_CACHE_KV
 */

const SNAPSHOT_KEY_PREFIX = 'sitemap:snapshot:v1:';
const SNAPSHOT_TTL_SECONDS = 60 * 60 * 24 * 45; // 45 days
const RETRY_AFTER_SECONDS = 300; // 5 minutes

function getSnapshotStore(env) {
  return env?.SITEMAP_CACHE_KV || null;
}

function getSnapshotKey(name) {
  return `${SNAPSHOT_KEY_PREFIX}${String(name || '').trim()}`;
}

/**
 * Persist latest successful sitemap payload.
 * Never throws.
 * @param {Object} env
 * @param {string} name
 * @param {string} xml
 * @returns {Promise<boolean>}
 */
export async function saveSitemapSnapshot(env, name, xml) {
  const store = getSnapshotStore(env);
  if (!store || !xml || !name) return false;

  const payload = JSON.stringify({
    xml: String(xml),
    updatedAt: new Date().toISOString(),
  });

  try {
    await store.put(getSnapshotKey(name), payload, {
      expirationTtl: SNAPSHOT_TTL_SECONDS,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Load last successful sitemap payload.
 * Never throws.
 * @param {Object} env
 * @param {string} name
 * @returns {Promise<{xml: string, updatedAt: string}|null>}
 */
export async function loadSitemapSnapshot(env, name) {
  const store = getSnapshotStore(env);
  if (!store || !name) return null;

  try {
    const raw = await store.get(getSnapshotKey(name));
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed?.xml) return null;

    return {
      xml: String(parsed.xml),
      updatedAt: String(parsed.updatedAt || ''),
    };
  } catch {
    return null;
  }
}

/**
 * Standard sitemap XML headers.
 * @param {string} cacheControl
 * @param {Record<string, string>} [extraHeaders]
 * @returns {Record<string, string>}
 */
export function buildSitemapHeaders(cacheControl, extraHeaders = {}) {
  return {
    'Content-Type': 'application/xml; charset=utf-8',
    'Cache-Control': cacheControl,
    'X-Robots-Tag': 'index, follow',
    ...extraHeaders,
  };
}

/**
 * Return stale snapshot if available, otherwise 503.
 * @param {Object} options
 * @param {Object} options.env
 * @param {string} options.name
 * @param {string} options.cacheControl
 * @returns {Promise<Response>}
 */
export async function respondWithSnapshotOr503({ env, name, cacheControl }) {
  const snapshot = await loadSitemapSnapshot(env, name);
  if (snapshot?.xml) {
    return new Response(snapshot.xml, {
      status: 200,
      headers: buildSitemapHeaders(cacheControl, {
        'X-Sitemap-Source': 'snapshot-stale',
        ...(snapshot.updatedAt
          ? { 'X-Sitemap-Snapshot-At': snapshot.updatedAt }
          : {}),
      }),
    });
  }

  return new Response('Sitemap temporarily unavailable', {
    status: 503,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      'Retry-After': String(RETRY_AFTER_SECONDS),
    },
  });
}
