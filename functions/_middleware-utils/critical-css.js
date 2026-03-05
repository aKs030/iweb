/**
 * Critical CSS Edge Inliner
 *
 * Inlines render-critical CSS directly into the HTML stream as <style> tags,
 * eliminating render-blocking <link> requests. Non-critical CSS is converted
 * to async loading via media-swap pattern.
 *
 * Strategy:
 * - tokens.css + root.css → inlined as <style> (design tokens + layout reset)
 * - main.css + animations.css → async loaded via media="print" swap trick
 *
 * CSS content is cached in KV with SWR semantics for ~1ms reads.
 *
 * @version 1.0.0
 */

const CSS_CACHE_VERSION = '20260306-2';
const CSS_TTL_MS = 3600 * 1000; // 1 hour

/**
 * CSS files to inline (order matters — tokens first).
 * These block first paint and must be in the initial HTML stream.
 */
const INLINE_CSS_PATHS = [
  '/content/styles/tokens.css',
  '/content/styles/root.css',
  '/content/components/menu/menu.css',
];

/**
 * CSS files to load asynchronously (non-critical for above-the-fold).
 * Converted from blocking <link> to async media-swap pattern.
 */
const ASYNC_CSS_PATHS = [
  '/content/styles/main.css',
  '/content/styles/animations.css',
  '/content/components/footer/footer.css',
];

/** Set of all CSS paths we handle (for quick lookup in HTMLRewriter) */
const ALL_MANAGED_CSS = new Set([...INLINE_CSS_PATHS, ...ASYNC_CSS_PATHS]);

/**
 * Build KV cache key for a CSS file.
 * @param {string} cssPath
 * @returns {string}
 */
function cssKvKey(cssPath) {
  return `css:${CSS_CACHE_VERSION}:${cssPath}`;
}

/**
 * Load a CSS file with KV caching + SWR.
 *
 * @param {Object} context - Cloudflare Pages context
 * @param {string} cssPath - Path like "/content/styles/tokens.css"
 * @returns {Promise<string>} CSS content
 */
async function loadCssCached(context, cssPath) {
  const kv = context.env?.SITEMAP_CACHE_KV;

  // Direct fetch fallback when KV unavailable (local dev)
  if (!kv) {
    return fetchCssFromAssets(context, cssPath);
  }

  const key = cssKvKey(cssPath);
  let cached = null;

  try {
    cached = await kv.get(key, 'json');
  } catch (err) {
    console.warn(`CSS KV error for ${key}:`, err);
  }

  const now = Date.now();

  if (cached?.css) {
    // SWR: serve stale, refresh in background
    if (now - cached.timestamp > CSS_TTL_MS) {
      context.waitUntil(refreshCssInKV(context, key, cssPath));
    }
    return cached.css;
  }

  // Cache miss: blocking fetch + store
  return refreshCssInKV(context, key, cssPath);
}

/**
 * Fetch CSS from ASSETS and store in KV.
 * @param {Object} context
 * @param {string} key - KV key
 * @param {string} cssPath
 * @returns {Promise<string>}
 */
async function refreshCssInKV(context, key, cssPath) {
  try {
    const css = await fetchCssFromAssets(context, cssPath);
    if (css) {
      await context.env.SITEMAP_CACHE_KV.put(
        key,
        JSON.stringify({ timestamp: Date.now(), css }),
      );
    }
    return css;
  } catch (err) {
    console.error(`CSS cache refresh failed for ${key}:`, err);
    return '';
  }
}

/**
 * Fetch CSS content from Pages ASSETS binding.
 * @param {Object} context
 * @param {string} cssPath
 * @returns {Promise<string>}
 */
async function fetchCssFromAssets(context, cssPath) {
  try {
    const url = new URL(cssPath, context.request.url);
    const res = await context.env.ASSETS.fetch(url);
    if (!res.ok) return '';
    return await res.text();
  } catch {
    return '';
  }
}

/**
 * Pre-load all critical CSS content in parallel.
 * Called once at request start, results stored for HTMLRewriter handlers.
 *
 * @param {Object} context - Cloudflare Pages context
 * @returns {Promise<Map<string, string>>} Map of path → CSS content
 */
export async function preloadCriticalCss(context) {
  const entries = await Promise.all(
    INLINE_CSS_PATHS.map(async (path) => {
      const css = await loadCssCached(context, path);
      return [path, css];
    }),
  );
  return new Map(entries);
}

/**
 * HTMLRewriter handler that transforms CSS <link> elements:
 *
 * 1. Inline CSS links (tokens.css, root.css) → replaced with <style> containing
 *    the CSS content directly. Eliminates 2 render-blocking HTTP requests.
 *
 * 2. Async CSS links (main.css, animations.css) → converted to non-blocking
 *    media="print" swap pattern with <noscript> fallback.
 *
 * Usage:
 *   const cssMap = await preloadCriticalCss(context);
 *   rewriter.on('link[rel="stylesheet"]', new CriticalCssInliner(cssMap));
 */
export class CriticalCssInliner {
  /**
   * @param {Map<string, string>} inlineCssMap - Map of path → CSS content
   */
  constructor(inlineCssMap) {
    this.inlineCssMap = inlineCssMap;
  }

  /** @param {Element} el */
  element(el) {
    const href = el.getAttribute('href');
    if (!href || !ALL_MANAGED_CSS.has(href)) return;

    // --- Inline CSS (tokens + root) ---
    const cssContent = this.inlineCssMap.get(href);
    if (cssContent) {
      // Replace <link> with <style> containing the CSS content
      el.replace(`<style data-inlined-from="${href}">${cssContent}</style>`, {
        html: true,
      });
      return;
    }

    // --- Async CSS (main + animations) ---
    if (ASYNC_CSS_PATHS.includes(href)) {
      // media="print" swap pattern:
      // 1. Browser loads with media="print" (non-blocking)
      // 2. onload swaps to media="all" → CSS applies
      // 3. <noscript> fallback for JS-disabled browsers
      el.replace(
        `<link rel="stylesheet" href="${href}" media="print" onload="this.media='all'" data-async-css>` +
          `<noscript><link rel="stylesheet" href="${href}"></noscript>`,
        { html: true },
      );
    }
  }
}
