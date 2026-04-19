import { createLogger } from '../../content/core/logger.js';

const log = createLogger('template-cache');
import { isLocalhost } from './dev-utils.js';

const TEMPLATE_TTL_SECONDS = 3600;

// Bump this whenever injected head/template markup or critical CSS changes.
export const DEPLOY_VERSION = '20260419-CSP-02';

export const KV_KEYS = {
  GLOBAL_HEAD: `template:${DEPLOY_VERSION}:global-head-v2`,
};

/**
 * @param {string} template
 * @returns {string}
 */
export function applyBuildVersion(template) {
  return String(template || '').replaceAll(
    '{{DEPLOY_VERSION}}',
    DEPLOY_VERSION,
  );
}

/**
 * Load template with KV caching + SWR.
 * @param {any} env
 * @param {string} kvKey
 * @param {string} fetchUrl
 * @param {any} ctx
 */
export async function loadTemplateWithCache(env, kvKey, fetchUrl, ctx) {
  const url = new URL(fetchUrl);
  const isLocal = isLocalhost(url.hostname);

  if (!env.SITEMAP_CACHE_KV || isLocal) {
    const fallbackRes = await env.ASSETS.fetch(url);
    return fallbackRes.ok ? await fallbackRes.text() : '';
  }

  let cachedItem = null;
  try {
    cachedItem = await env.SITEMAP_CACHE_KV.get(kvKey, 'json');
  } catch (err) {
    log.warn(`KV Error bei Key ${kvKey}:`, err);
  }

  const now = Date.now();
  const ttlMs = TEMPLATE_TTL_SECONDS * 1000;

  if (cachedItem && cachedItem.html) {
    if (now - cachedItem.timestamp > ttlMs) {
      ctx.waitUntil(refreshTemplateInKV(env, kvKey, fetchUrl));
    }

    return cachedItem.html;
  }

  return await refreshTemplateInKV(env, kvKey, fetchUrl);
}

/**
 * Fetch template and persist to KV.
 * @param {any} env
 * @param {string} kvKey
 * @param {string} fetchUrl
 */
async function refreshTemplateInKV(env, kvKey, fetchUrl) {
  try {
    const res = await env.ASSETS.fetch(new URL(fetchUrl));
    if (!res.ok) {
      log.error(`Template fetch failed: ${fetchUrl} → ${res.status}`);
      return '';
    }
    const html = await res.text();

    await env.SITEMAP_CACHE_KV.put(
      kvKey,
      JSON.stringify({ timestamp: Date.now(), html }),
    );

    return html;
  } catch (err) {
    log.error(`Template refresh failed for ${kvKey}:`, err);
    return '';
  }
}
