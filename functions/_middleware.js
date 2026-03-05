/**
 * Cloudflare Pages Middleware — Streaming HTML Edge Processing
 *
 * OPTIMIERUNGEN v5.0.0:
 * - **Edge Streaming**: Alle HTML-Transformationen laufen jetzt über HTMLRewriter.
 *   Der Browser empfängt <head> (CSS, Import-Map) sofort, während der Body noch
 *   an der Edge generiert wird → drastisch besserer FCP.
 * - Templates werden in KV gecacht (SITEMAP_CACHE_KV) → eliminiert 2 fetch() pro HTML-Request
 * - Template-TTL: 1 Stunde (revalidiert im Hintergrund via stale-while-revalidate)
 * - CSP Nonce + SEO Meta via Streaming-Handlers (kein `await response.text()`)
 * - Fallback: Buffered Pipeline für Edge-Cases (applyRouteSeo bei komplexen Routen)
 *
 * @version 5.0.0
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

// KV-Cache TTL für Templates: 1 Stunde
const TEMPLATE_TTL_SECONDS = 3600;
// Bump this whenever base-head template markup changes.
const TEMPLATE_CACHE_VERSION = '20260304-8';

// KV-Schlüssel für Template-Cache
const KV_KEYS = {
  HEAD: `template:${TEMPLATE_CACHE_VERSION}:base-head`,
};

/**
 * Sanitize cached template HTML to avoid unsupported viewport keys
 * on older Safari/WebKit builds.
 *
 * @param {string} kvKey
 * @param {string} html
 * @returns {string}
 */
function sanitizeTemplateHtml(kvKey, html) {
  if (!html) return '';
  if (!kvKey.includes('base-head')) return html;

  let sanitized = html.replace(
    /\s*,\s*interactive-widget=resizes-content/g,
    '',
  );

  // Strip legacy browser-chrome metas that can interfere with viewport-fit behavior.
  sanitized = sanitized.replace(
    /<meta\b[^>]*\bname=(["'])(?:theme-color|apple-mobile-web-app-status-bar-style|apple-mobile-web-app-capable|mobile-web-app-capable|apple-touch-fullscreen|apple-mobile-web-app-title)\1[^>]*>\s*/gi,
    '',
  );

  return sanitized;
}

/**
 * Lädt ein Template — zuerst aus KV, dann per fetch() als Fallback.
 * Implementiert echtes Stale-While-Revalidate (SWR) und Graceful Degradation.
 *
 * @param {Object} env - Cloudflare Env-Objekt (mit SITEMAP_CACHE_KV)
 * @param {string} kvKey - KV-Schlüssel für dieses Template
 * @param {string} fetchUrl - Absolute URL zum Laden bei KV-Miss
 * @param {ExecutionContext} ctx - Pages Execution Context für waitUntil
 * @returns {Promise<string>} Template-HTML
 */
async function loadTemplateWithCache(env, kvKey, fetchUrl, ctx) {
  // 1. Fallback: Falls KV nicht gebunden ist (z.B. lokales dev ohne richtiges Binding)
  if (!env.SITEMAP_CACHE_KV) {
    const fallbackRes = await env.ASSETS.fetch(new URL(fetchUrl));
    return fallbackRes.ok ? await fallbackRes.text() : '';
  }

  // 2. KV-Lookup mit Fehler-Grace-Handling
  let cachedItem = null;
  try {
    cachedItem = await env.SITEMAP_CACHE_KV.get(kvKey, 'json');
  } catch (err) {
    console.warn(`KV Error bei Key ${kvKey} - verwende Fallback-Fetch:`, err);
  }

  const now = Date.now();
  const ONE_HOUR_MS = TEMPLATE_TTL_SECONDS * 1000;

  // 3. Cache-Hit: SWR Logik
  if (cachedItem && cachedItem.html) {
    const cachedHtml = sanitizeTemplateHtml(kvKey, cachedItem.html);

    if (cachedHtml !== cachedItem.html) {
      ctx.waitUntil(
        env.SITEMAP_CACHE_KV.put(
          kvKey,
          JSON.stringify({
            timestamp: now,
            html: cachedHtml,
          }),
        ),
      );
    }

    // Wenn Template älter als eine Stunde ist -> im Hintergrund aktualisieren
    if (now - cachedItem.timestamp > ONE_HOUR_MS) {
      ctx.waitUntil(refreshTemplateInKV(env, kvKey, fetchUrl));
    }
    // Sofort die (ggf. leicht alte) Version aus dem Cache zurückgeben (~1-5ms)
    return cachedHtml;
  }

  // 4. Cache-Miss: Blockierendes Laden und Speichern
  return await refreshTemplateInKV(env, kvKey, fetchUrl);
}

/**
 * Führt den eigentlichen Fetch durch und speichert das Ergebnis im KV.
 * Diese Funktion kann blockierend oder non-blocking (via ctx.waitUntil) aufgerufen werden.
 */
async function refreshTemplateInKV(env, kvKey, fetchUrl) {
  try {
    // INTERNAL FETCHER: Bypass externes Netzwerk und frage Cloudflare Pages Assets direkt ab
    const res = await env.ASSETS.fetch(new URL(fetchUrl));
    if (!res.ok) {
      console.error(
        `Template fetch fehlgeschlagen: ${fetchUrl} → ${res.status}`,
      );
      return '';
    }
    const html = sanitizeTemplateHtml(kvKey, await res.text());

    await env.SITEMAP_CACHE_KV.put(
      kvKey,
      JSON.stringify({
        timestamp: Date.now(),
        html: html,
      }),
    );

    return html;
  } catch (err) {
    console.error(`Fehler beim Aktualisieren des Templates ${kvKey}:`, err);
    return '';
  }
}

/**
 * Middleware entry point — runs on every request.
 *
 * v5 KEY CHANGE: All HTML transforms are now streamed via HTMLRewriter.
 * The response body is never fully buffered (`await response.text()` eliminated).
 * This lets the browser start parsing <head> immediately while the edge
 * is still processing <body>.
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

  // -----------------------------------------------------------------------
  // Parallel: upstream response + templates + route meta (all at once)
  // -----------------------------------------------------------------------
  const baseUrl = `${url.protocol}//${url.host}`;

  const [upstreamResult, headTemplate, routeMeta] = await Promise.all([
    context.next().catch(() => null),
    loadTemplateWithCache(
      context.env,
      KV_KEYS.HEAD,
      `${baseUrl}/content/templates/base-head.html`,
      context,
    ),
    buildRouteMeta(context, url).catch(() => null),
  ]);

  if (!upstreamResult) {
    return new Response('Internal Server Error', { status: 500 });
  }

  const response = upstreamResult;

  // Nur HTML verarbeiten
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
  // Build a single HTMLRewriter pipeline (all transforms streamed)
  // -----------------------------------------------------------------------
  const rewriter = new HTMLRewriter();

  // 1. Section injection (Edge-Side Includes for hero, section3, etc.)
  rewriter.on('section[data-section-src]', new SectionInjector(context));

  // 2. Template injection (replaces <!-- INJECT:BASE-HEAD --> etc.)
  if (headTemplate) {
    rewriter.on(
      '*',
      new TemplateCommentHandler({
        head: headTemplate,
      }),
    );
  }

  // 3. SEO meta injection (streaming upsert of title, meta, canonical, schema)
  if (routeMeta) {
    const seoHandler = new SeoMetaHandler(routeMeta);
    rewriter.on('title', seoHandler);
    rewriter.on('meta', seoHandler);
    rewriter.on('link[rel="canonical"]', seoHandler);
    rewriter.on('head', seoHandler);
  }

  // 4. CSP Nonce injection (streaming, no buffering)
  const isLocal = isLocalhost(url.hostname);
  const nonce = isLocal ? null : generateNonce();
  if (nonce) {
    const nonceHandler = new NonceInjector(nonce);
    rewriter.on('script', nonceHandler);
    rewriter.on('style', nonceHandler);
  }

  // -----------------------------------------------------------------------
  // Stream the response — browser receives <head> immediately
  // -----------------------------------------------------------------------
  const transformedResponse = rewriter.transform(response);

  // Remove Content-Length since streaming responses are chunked
  const newHeaders = new Headers(initialHeaders);
  newHeaders.delete('Content-Length');
  newHeaders.set('Transfer-Encoding', 'chunked');

  return new Response(transformedResponse.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}
