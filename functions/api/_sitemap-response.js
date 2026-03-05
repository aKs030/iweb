import {
  buildSitemapHeaders,
  createSnapshotStaleResponse,
  loadSitemapSnapshot,
  saveSitemapSnapshot,
} from './_sitemap-snapshot.js';

/**
 * Dedupe list entries while preserving insertion order.
 * @template T
 * @param {T[]} list
 * @param {(item: T) => string} keyFn
 * @returns {T[]}
 */
export function dedupeBy(list, keyFn) {
  const seen = new Set();
  const out = [];

  for (const item of list || []) {
    const key = String(keyFn(item) || '');
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }

  return out;
}

/**
 * Save sitemap XML snapshot and return standard XML response.
 * @param {Object} options
 * @param {Object} options.env
 * @param {string} options.name
 * @param {string} options.xml
 * @param {string} options.cacheControl
 * @param {Record<string, string>} [options.extraHeaders]
 * @returns {Promise<Response>}
 */
export async function saveAndRespondSitemapXml({
  env,
  name,
  xml,
  cacheControl,
  extraHeaders = {},
}) {
  await saveSitemapSnapshot(env, name, xml);
  return new Response(xml, {
    headers: buildSitemapHeaders(cacheControl, extraHeaders),
  });
}

/**
 * Return stale snapshot if available, otherwise return provided fallback XML.
 * @param {Object} options
 * @param {Object} options.env
 * @param {string} options.name
 * @param {string} options.cacheControl
 * @param {string} options.fallbackXml
 * @param {string} options.fallbackSource
 * @returns {Promise<Response>}
 */
export async function respondWithSnapshotOrFallback({
  env,
  name,
  cacheControl,
  fallbackXml,
  fallbackSource,
}) {
  const snapshot = await loadSitemapSnapshot(env, name);
  if (snapshot?.xml) {
    return createSnapshotStaleResponse(snapshot, cacheControl);
  }

  return new Response(fallbackXml, {
    headers: buildSitemapHeaders(cacheControl, {
      'X-Sitemap-Source': fallbackSource,
    }),
  });
}
