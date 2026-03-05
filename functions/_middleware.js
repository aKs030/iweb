/**
 * Cloudflare Pages Middleware — Edge Streaming v7.0.0
 *
 * OPTIMIERUNGEN v7.0.0:
 * - **Critical CSS Inlining**: tokens.css + root.css direkt als <style> gestreamt
 *   → 2 render-blockierende Requests eliminiert
 * - **Async CSS Loading**: main.css + animations.css via media-swap Pattern
 *   → nicht mehr render-blockierend
 * - **Edge HTML Cache**: Cloudflare Cache API für fertig transformierte Responses
 *   → Pipeline-Skip bei Cache-Hit (~0ms statt ~50-100ms)
 * - **Edge Speculation Rules**: Route-spezifische Prefetch-Rules direkt im <head>
 *   → Prefetch startet ~500ms früher als bei Client-Side-Berechnung
 * - **Link-Header Preload**: CSS + JS als HTTP Link-Header
 * - **Edge-Side Section Caching**: hero.html / section3.html in KV (SWR)
 * - **Streaming Pipeline**: HTMLRewriter — Browser empfängt <head> sofort
 * - **Template-KV-Cache**: base-head.html in KV gecacht (SWR)
 * - **CSP Nonce + SEO Meta**: Via Streaming-Handlers (kein Buffering)
 * - **Server-Timing**: Observability-Header für DevTools-Timing-Tab
 * - **Deploy-Version Header**: SW-Cache-Konsistenz über X-Deploy-Version
 *
 * @version 7.0.0
 */

import { generateNonce } from './_middleware-utils/csp-manager.js';
import { SectionInjector } from './_middleware-utils/template-injector.js';
import { buildRouteMeta } from './_middleware-utils/route-seo.js';
import {
  TemplateCommentHandler,
  NonceInjector,
  SeoMetaHandler,
} from './_middleware-utils/streaming-handlers.js';
import {
  isLocalhost,
  normalizeLocalDevHeaders,
} from './_middleware-utils/dev-utils.js';
import { buildResponseLinkHeaders } from './_middleware-utils/early-hints.js';
import {
  preloadCriticalCss,
  CriticalCssInliner,
} from './_middleware-utils/critical-css.js';
import {
  EdgeSpeculationRules,
  StaticSpeculationRemover,
} from './_middleware-utils/edge-speculation.js';
import {
  matchEdgeCache,
  storeInEdgeCache,
} from './_middleware-utils/edge-cache.js';
import {
  HeaderInjector,
  FooterInjector,
} from './_middleware-utils/esi-shell.js';

// KV-Cache TTL für Templates: 1 Stunde
const TEMPLATE_TTL_SECONDS = 3600;

// Bump this whenever base-head template markup or critical CSS changes.
const DEPLOY_VERSION = '20260306-2';

// KV-Schlüssel für Template-Cache
const KV_KEYS = {
  HEAD: `template:${DEPLOY_VERSION}:base-head`,
};

// Pre-compute Link header values at module load (immutable per deploy)
const RESPONSE_LINK_HEADERS = buildResponseLinkHeaders();

/**
 * Sanitize cached template HTML to avoid unsupported viewport keys
 * on older Safari/WebKit builds.
 */
function sanitizeTemplateHtml(kvKey, html) {
  if (!html) return '';
  if (!kvKey.includes('base-head')) return html;

  let sanitized = html.replace(
    /\s*,\s*interactive-widget=resizes-content/g,
    '',
  );

  sanitized = sanitized.replace(
    /<meta\b[^>]*\bname=(['"])(?:theme-color|apple-mobile-web-app-status-bar-style|apple-mobile-web-app-capable|mobile-web-app-capable|apple-touch-fullscreen|apple-mobile-web-app-title)\1[^>]*>\s*/gi,
    '',
  );

  return sanitized;
}

/**
 * Load template with KV caching + SWR.
 */
async function loadTemplateWithCache(env, kvKey, fetchUrl, ctx) {
  if (!env.SITEMAP_CACHE_KV) {
    const fallbackRes = await env.ASSETS.fetch(new URL(fetchUrl));
    return fallbackRes.ok ? await fallbackRes.text() : '';
  }

  let cachedItem = null;
  try {
    cachedItem = await env.SITEMAP_CACHE_KV.get(kvKey, 'json');
  } catch (err) {
    console.warn(`KV Error bei Key ${kvKey}:`, err);
  }

  const now = Date.now();
  const ONE_HOUR_MS = TEMPLATE_TTL_SECONDS * 1000;

  if (cachedItem && cachedItem.html) {
    const cachedHtml = sanitizeTemplateHtml(kvKey, cachedItem.html);

    if (cachedHtml !== cachedItem.html) {
      ctx.waitUntil(
        env.SITEMAP_CACHE_KV.put(
          kvKey,
          JSON.stringify({ timestamp: now, html: cachedHtml }),
        ),
      );
    }

    if (now - cachedItem.timestamp > ONE_HOUR_MS) {
      ctx.waitUntil(refreshTemplateInKV(env, kvKey, fetchUrl));
    }

    return cachedHtml;
  }

  return await refreshTemplateInKV(env, kvKey, fetchUrl);
}

/**
 * Fetch template and persist to KV.
 */
async function refreshTemplateInKV(env, kvKey, fetchUrl) {
  try {
    const res = await env.ASSETS.fetch(new URL(fetchUrl));
    if (!res.ok) {
      console.error(`Template fetch failed: ${fetchUrl} → ${res.status}`);
      return '';
    }
    const html = sanitizeTemplateHtml(kvKey, await res.text());

    await env.SITEMAP_CACHE_KV.put(
      kvKey,
      JSON.stringify({ timestamp: Date.now(), html }),
    );

    return html;
  } catch (err) {
    console.error(`Template refresh failed for ${kvKey}:`, err);
    return '';
  }
}

/**
 * Middleware entry point — runs on every request.
 *
 * v7 PIPELINE:
 * 1. Skip non-HTML (API routes, redirects)
 * 2. Check Edge HTML Cache → return immediately on hit
 * 3. Parallel: upstream + templates + route meta + critical CSS
 * 4. Build HTMLRewriter pipeline (section injection, CSS inlining, SEO, nonce, speculation)
 * 5. Stream response with Link headers + Server-Timing + Deploy-Version
 * 6. Store transformed response in Edge Cache (async, non-blocking)
 *
 * @param {Object} context - Cloudflare Pages context
 */
export async function onRequest(context) {
  const url = new URL(context.request.url);

  // Skip API routes
  if (url.pathname.startsWith('/api/')) {
    return await context.next();
  }

  // Redirect non-www → www (301 permanent)
  if (url.hostname === 'abdulkerimsesli.de') {
    url.hostname = 'www.abdulkerimsesli.de';
    return Response.redirect(url.href, 301);
  }

  const isLocal = isLocalhost(url.hostname);

  // -----------------------------------------------------------------------
  // Edge HTML Cache: skip entire pipeline on cache hit
  // -----------------------------------------------------------------------
  if (!isLocal) {
    const cachedResponse = await matchEdgeCache(url);
    if (cachedResponse) {
      // Inject fresh CSP nonce even on cache hit
      const nonce = generateNonce();
      const nonceHandler = new NonceInjector(nonce);
      const rewriter = new HTMLRewriter();
      rewriter.on('script', nonceHandler);
      rewriter.on('style', nonceHandler);

      const withNonce = rewriter.transform(cachedResponse);
      const headers = new Headers(withNonce.headers);
      headers.set('X-Deploy-Version', DEPLOY_VERSION);
      headers.delete('Content-Length');

      return new Response(withNonce.body, {
        status: withNonce.status,
        headers,
      });
    }
  }

  // -----------------------------------------------------------------------
  // Parallel: upstream + templates + route meta + critical CSS
  // -----------------------------------------------------------------------
  const baseUrl = `${url.protocol}//${url.host}`;

  const [upstreamResult, headTemplate, routeMeta, criticalCssMap] =
    await Promise.all([
      context.next().catch(() => null),
      loadTemplateWithCache(
        context.env,
        KV_KEYS.HEAD,
        `${baseUrl}/content/templates/base-head.html`,
        context,
      ),
      buildRouteMeta(context, url).catch(() => null),
      preloadCriticalCss(context),
    ]);

  if (!upstreamResult) {
    return new Response('Internal Server Error', { status: 500 });
  }

  const response = upstreamResult;

  // Only process HTML
  const initialHeaders = new Headers(response.headers);
  const localHeaderAdjusted = normalizeLocalDevHeaders(
    initialHeaders,
    url.hostname,
  );
  const contentType = response.headers.get('content-type') || '';

  if (!contentType.includes('text/html')) {
    if (!localHeaderAdjusted) return response;
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: initialHeaders,
    });
  }

  // -----------------------------------------------------------------------
  // Build HTMLRewriter pipeline — all transforms streamed in one pass
  // -----------------------------------------------------------------------
  const rewriter = new HTMLRewriter();

  // 1. Section injection (Edge-Side Includes, KV-cached SWR)
  rewriter.on('section[data-section-src]', new SectionInjector(context));

  // 2. Template injection (replaces <!-- INJECT:BASE-HEAD -->)
  if (headTemplate) {
    rewriter.on('*', new TemplateCommentHandler({ head: headTemplate }));
  }

  // 3. Critical CSS inlining + async loading
  if (criticalCssMap.size > 0) {
    rewriter.on(
      'link[rel="stylesheet"]',
      new CriticalCssInliner(criticalCssMap),
    );
  }

  // 4. Remove static speculation rules (replaced by edge-computed rules)
  rewriter.on(
    'script[type="speculationrules"]',
    new StaticSpeculationRemover(),
  );

  // 5. Inject route-aware speculation rules before </head>
  rewriter.on('head', new EdgeSpeculationRules(url.pathname));

  // 6. SEO meta injection
  if (routeMeta) {
    const seoHandler = new SeoMetaHandler(routeMeta);
    rewriter.on('title', seoHandler);
    rewriter.on('meta', seoHandler);
    rewriter.on('link[rel="canonical"]', seoHandler);
    rewriter.on('head', seoHandler);
  }

  // 7. CSP Nonce injection
  const nonce = isLocal ? null : generateNonce();
  if (nonce) {
    const nonceHandler = new NonceInjector(nonce);
    rewriter.on('script', nonceHandler);
    rewriter.on('style', nonceHandler);
  }

  // 8. Edge-Side Includes for Header/Footer Shells
  rewriter.on('a.skip-link', new HeaderInjector(url)); // prepends to the page (after skip-link)
  rewriter.on('body', new FooterInjector()); // appends to bottom of body

  // -----------------------------------------------------------------------
  // Stream + build response headers
  // -----------------------------------------------------------------------
  const transformedResponse = rewriter.transform(response);

  const newHeaders = new Headers(initialHeaders);
  newHeaders.delete('Content-Length');
  newHeaders.set('Transfer-Encoding', 'chunked');

  // Link headers: preload resources via HTTP headers
  for (const linkValue of RESPONSE_LINK_HEADERS) {
    newHeaders.append('Link', linkValue);
  }

  // Deploy version for SW cache consistency
  newHeaders.set('X-Deploy-Version', DEPLOY_VERSION);

  // Server-Timing for observability
  const timingParts = [];
  if (headTemplate) timingParts.push('tpl;desc="head-template"');
  if (criticalCssMap.size > 0)
    timingParts.push(`css;desc="inlined ${criticalCssMap.size} CSS"`);
  if (routeMeta) timingParts.push('seo;desc="route-meta"');
  if (nonce) timingParts.push('csp;desc="nonce"');
  timingParts.push('spec;desc="edge-speculation"');
  if (timingParts.length) {
    newHeaders.set('Server-Timing', timingParts.join(', '));
  }

  const finalResponse = new Response(transformedResponse.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });

  // -----------------------------------------------------------------------
  // Store in Edge Cache (async, non-blocking)
  // -----------------------------------------------------------------------
  if (!isLocal) {
    storeInEdgeCache(url, finalResponse.clone(), context);
  }

  return finalResponse;
}
