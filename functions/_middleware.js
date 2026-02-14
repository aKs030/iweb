/**
 * Cloudflare Pages Middleware — Dynamic HTML Template Injection
 *
 * Uses shared template injection utility for consistency.
 *
 * @version 1.2.0
 */

import {
  injectTemplates,
  loadTemplateFromURL,
} from '../content/core/template-injector.js';

/**
 * Middleware entry point — runs on every request.
 * @param {Object} context - Cloudflare Pages context
 */
export async function onRequest(context) {
  const url = new URL(context.request.url);

  // Skip API routes and GTM proxy - they have their own middleware/logic
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/5dwc/')) {
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
  } catch (err) {
    console.error('[middleware] context.next() failed:', err);
    return new Response('Internal Server Error', { status: 500 });
  }

  // Only process HTML responses
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) {
    return response;
  }

  let html = await response.text();

  // Skip if no markers present
  if (
    !html.includes('INJECT:BASE-HEAD') &&
    !html.includes('INJECT:BASE-LOADER')
  ) {
    return new Response(html, response);
  }

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

  // Return modified response with original headers
  const newHeaders = new Headers(response.headers);
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
