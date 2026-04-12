import { createLogger } from '../../content/core/logger.js';

const log = createLogger('template-injector');
/**
 * Template Injection Utilities — Edge-Cached Section Streaming
 *
 * OPTIMIERUNGEN v2.0.0:
 * - Section HTML wird in KV gecacht (SITEMAP_CACHE_KV) → eliminiert
 *   env.ASSETS.fetch() bei jedem HTML-Request für hero/section3
 * - SWR (Stale-While-Revalidate) Logik: Sofort aus Cache liefern,
 *   im Hintergrund aktualisieren wenn TTL abgelaufen
 * - Graceful Degradation: Fällt auf ASSETS.fetch() zurück wenn KV fehlt
 *
 * @version 2.0.0
 */

// KV-Cache TTL: 1 Stunde (Sections ändern sich selten)
const SECTION_TTL_MS = 3600 * 1000;
// Bump when section HTML structure changes.
const SECTION_CACHE_VERSION = '20260305-1';

/**
 * Build KV key for section partials.
 * @param {string} sectionPath - e.g. "/pages/home/hero"
 * @returns {string}
 */
function sectionKvKey(sectionPath) {
  return `section:${SECTION_CACHE_VERSION}:${sectionPath}`;
}

/**
 * Load template from URL via ASSETS binding (internal only, no external fetch).
 * @param {Object} context - Cloudflare Pages context
 * @param {string} path - Template path
 * @returns {Promise<string>} Template content
 */
export async function loadTemplateFromURL(context, path) {
  try {
    const url = new URL(path, context.request.url);
    const response = await context.env.ASSETS.fetch(url);
    if (!response.ok) return '';
    return await response.text();
  } catch {
    return '';
  }
}

/**
 * Load section HTML with KV caching + SWR semantics.
 *
 * 1. Try KV cache → return immediately if fresh
 * 2. If stale → return stale + refresh in background (ctx.waitUntil)
 * 3. If miss → blocking fetch + store in KV
 * 4. If KV unavailable → fall back to ASSETS.fetch()
 *
 * @param {Object} context - Cloudflare Pages context
 * @param {string} sectionPath - e.g. "/pages/home/hero"
 * @returns {Promise<string>} Section HTML
 */
async function loadSectionCached(context, sectionPath) {
  const kv = context.env?.SITEMAP_CACHE_KV;
  const fetchUrl = `${sectionPath}.html`;

  // Graceful degradation: no KV → direct fetch
  if (!kv) {
    return loadTemplateFromURL(context, fetchUrl);
  }

  const kvKey = sectionKvKey(sectionPath);
  let cachedItem = null;

  try {
    cachedItem = await kv.get(kvKey, 'json');
  } catch (err) {
    log.warn(`Section KV error for ${kvKey}:`, err);
  }

  const now = Date.now();

  // Cache hit
  if (cachedItem?.html) {
    // SWR: If stale, refresh in background
    if (now - cachedItem.timestamp > SECTION_TTL_MS) {
      context.waitUntil(refreshSectionInKV(context, kvKey, fetchUrl));
    }
    return cachedItem.html;
  }

  // Cache miss: blocking fetch + store
  return refreshSectionInKV(context, kvKey, fetchUrl);
}

/**
 * Fetch section HTML from ASSETS and persist to KV.
 * @param {Object} context
 * @param {string} kvKey
 * @param {string} fetchUrl
 * @returns {Promise<string>}
 */
async function refreshSectionInKV(context, kvKey, fetchUrl) {
  try {
    const html = await loadTemplateFromURL(context, fetchUrl);
    if (html) {
      await context.env.SITEMAP_CACHE_KV.put(
        kvKey,
        JSON.stringify({ timestamp: Date.now(), html }),
      );
    }
    return html;
  } catch (err) {
    log.error(`Section cache refresh failed for ${kvKey}:`, err);
    return '';
  }
}

/**
 * HTMLRewriter handler for Edge-Side Includes with KV caching.
 *
 * Injects section partials into <section data-section-src="..."> elements.
 * Uses KV-backed caching to avoid repeated ASSETS.fetch() calls per request.
 */
export class SectionInjector {
  /**
   * @param {Object} context - Cloudflare Pages context
   */
  constructor(context) {
    this.context = context;
  }

  /**
   * @param {Element} el - HTMLRewriter element
   */
  async element(el) {
    const src = el.getAttribute('data-section-src');
    if (!src) return;

    // Only inject known partials to avoid arbitrary edge bloat
    if (src.endsWith('/hero') || src.endsWith('/section3')) {
      const htmlStr = await loadSectionCached(this.context, src);
      if (htmlStr) {
        el.setInnerContent(htmlStr, { html: true });
        el.setAttribute('data-ssr-loaded', 'true');
        // Remove the data-section-src to prevent client-side re-fetch
        el.removeAttribute('data-section-src');
      }
    }
  }
}
