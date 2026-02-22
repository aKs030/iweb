/**
 * Cloudflare Pages Middleware — Dynamic HTML Template Injection + CSP Nonces
 *
 * Injects base-head and base-loader templates into HTML responses.
 * Generates per-request CSP nonces to replace 'unsafe-inline'.
 *
 * @version 3.0.0 - Refactored & Modular
 */

import { generateNonce, injectNonce } from './_middleware-utils/csp-manager.js';
import {
  injectTemplates,
  loadTemplateFromURL,
  SectionInjector,
} from './_middleware-utils/template-injector.js';
import { ensureViewportMeta } from './_middleware-utils/viewport-manager.js';
import {
  isLocalhost,
  normalizeLocalDevHeaders,
} from './_middleware-utils/dev-utils.js';

/**
 * Middleware entry point — runs on every request.
 * @param {Object} context - Cloudflare Pages context
 */
export async function onRequest(context) {
  const url = new URL(context.request.url);

  // Skip API routes - they have their own middleware
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

  // Only process HTML responses
  const initialHeaders = new Headers(response.headers);
  const localHeaderAdjusted = normalizeLocalDevHeaders(
    initialHeaders,
    url.hostname,
  );
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) {
    if (!localHeaderAdjusted) {
      return response;
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: initialHeaders,
    });
  }

  // Transform sections via Edge-Side Includes before converting to text
  response = new HTMLRewriter()
    .on('section[data-section-src]', new SectionInjector(context))
    .transform(response);

  let html = await response.text();
  const hasTemplateMarkers =
    html.includes('INJECT:BASE-HEAD') || html.includes('INJECT:BASE-LOADER');

  if (hasTemplateMarkers) {
    // Fetch both templates in parallel
    const [headTemplate, loaderTemplate] = await Promise.all([
      loadTemplateFromURL(context, '/content/templates/base-head.html'),
      loadTemplateFromURL(context, '/content/templates/base-loader.html'),
    ]);

    // Inject using shared utility
    html = injectTemplates(html, {
      head: headTemplate,
      loader: loaderTemplate,
    });
  }

  html = ensureViewportMeta(html);

  // Generate CSP nonce (only for production)
  const isLocal = isLocalhost(url.hostname);
  const nonce = isLocal ? null : generateNonce();

  // Inject nonce into inline scripts/styles
  if (nonce) {
    html = injectNonce(html, nonce);
  }

  // Return modified response with original headers
  const newHeaders = new Headers(initialHeaders);
  newHeaders.set(
    'Content-Length',
    new TextEncoder().encode(html).length.toString(),
  );

  /*
  // Update CSP header with nonce
  if (nonce) {
    const csp = newHeaders.get('Content-Security-Policy');
    if (csp) {
      newHeaders.set('Content-Security-Policy', applyNonceToCSP(csp, nonce));
    }
  }
  */

  return new Response(html, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}
