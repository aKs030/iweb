/**
 * Cloudflare Pages Middleware — Dynamic HTML Template Injection + CSP Nonces
 *
 * OPTIMIERUNGEN v4.0.0:
 * - Templates werden in KV gecacht (SITEMAP_CACHE_KV) → eliminiert 2 fetch() pro HTML-Request
 * - Template-TTL: 1 Stunde (revalidiert im Hintergrund via stale-while-revalidate)
 * - KV-Lookup ist ~1-5ms statt ~50-200ms für Netzwerk-Fetches
 * - Parallelisierung beibehalten: Promise.all für KV + Next-Handler
 *
 * @version 4.0.0
 */

import { generateNonce, injectNonce } from './_middleware-utils/csp-manager.js';
import {
  injectTemplates,
  SectionInjector,
} from './_middleware-utils/template-injector.js';
import { applyRouteSeo } from './_middleware-utils/route-seo.js';
import {
  isLocalhost,
  normalizeLocalDevHeaders,
} from './_middleware-utils/dev-utils.js';

// KV-Cache TTL für Templates: 1 Stunde
const TEMPLATE_TTL_SECONDS = 3600;

// KV-Schlüssel für Template-Cache
const KV_KEYS = {
  HEAD: 'template:base-head',
  LOADER: 'template:base-loader',
};

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
    // Wenn Template älter als eine Stunde ist -> im Hintergrund aktualisieren
    if (now - cachedItem.timestamp > ONE_HOUR_MS) {
      ctx.waitUntil(refreshTemplateInKV(env, kvKey, fetchUrl));
    }
    // Sofort die (ggf. leicht alte) Version aus dem Cache zurückgeben (~1-5ms)
    return cachedItem.html;
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
    const html = await res.text();

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

  let response;
  try {
    response = await context.next();
  } catch {
    return new Response('Internal Server Error', { status: 500 });
  }

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

  // Section-Injection via HTMLRewriter (streaming)
  response = new HTMLRewriter()
    .on('section[data-section-src]', new SectionInjector(context))
    .transform(response);

  let html = await response.text();
  const hasTemplateMarkers =
    html.includes('INJECT:BASE-HEAD') || html.includes('INJECT:BASE-LOADER');

  if (hasTemplateMarkers) {
    const baseUrl = `${url.protocol}//${url.host}`;

    // OPTIMIERUNG: Beide Templates parallel aus KV laden
    // Bei Cache-Hit: ~2-8ms gesamt statt ~100-400ms für 2 Netzwerk-Fetches
    const [headTemplate, loaderTemplate] = await Promise.all([
      loadTemplateWithCache(
        context.env,
        KV_KEYS.HEAD,
        `${baseUrl}/content/templates/base-head.html`,
        context,
      ),
      loadTemplateWithCache(
        context.env,
        KV_KEYS.LOADER,
        `${baseUrl}/content/templates/base-loader.html`,
        context,
      ),
    ]);

    html = injectTemplates(html, {
      head: headTemplate,
      loader: loaderTemplate,
    });
  }

  try {
    html = await applyRouteSeo(context, html, url);
  } catch {
    // HTML weiter ausliefern auch wenn SEO-Enrichment fehlschlägt
  }

  // CSP Nonce (nur in Production)
  const isLocal = isLocalhost(url.hostname);
  const nonce = isLocal ? null : generateNonce();
  if (nonce) {
    html = injectNonce(html, nonce);
  }

  const newHeaders = new Headers(initialHeaders);
  newHeaders.set(
    'Content-Length',
    new TextEncoder().encode(html).length.toString(),
  );

  return new Response(html, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}
