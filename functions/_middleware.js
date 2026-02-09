/**
 * Cloudflare Pages Middleware — Dynamic HTML Template Injection
 *
 * Replaces <!-- INJECT:BASE-HEAD --> and <!-- INJECT:BASE-LOADER -->
 * markers in HTML responses with the actual template content at the edge.
 *
 * This eliminates template duplication across HTML files — the templates
 * live only in content/templates/ and are injected on every request.
 *
 * @version 1.0.0
 */

/** @type {Map<string, string>} Template cache (persists per isolate) */
const templateCache = new Map();

/**
 * Fetch a static asset and cache it in memory.
 * @param {Object} context - Cloudflare Pages context
 * @param {string} path
 * @returns {Promise<string>}
 */
async function getTemplate(context, path) {
  if (templateCache.has(path)) {
    return templateCache.get(path);
  }

  const url = new URL(path, context.request.url);
  const res = await context.env.ASSETS.fetch(url.href);

  if (!res.ok) {
    console.warn(`[middleware] Template not found: ${path} (${res.status})`);
    return '';
  }

  const text = await res.text();
  templateCache.set(path, text);
  return text;
}

/**
 * Middleware entry point — runs on every request.
 * Skips API routes (handled by their own functions).
 * @param {Object} context - Cloudflare Pages context
 */
export async function onRequest(context) {
  const url = new URL(context.request.url);

  // Skip API routes — they have their own handlers and don't need template injection
  // Move this BEFORE redirect to avoid breaking POST requests
  if (url.pathname.startsWith('/api/')) {
    return await context.next();
  }

  // Redirect non-www → www (301 permanent)
  // Cloudflare Pages _redirects doesn't support host-based redirects,
  // so we handle it here in the middleware.
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
    getTemplate(context, '/content/templates/base-head.html'),
    getTemplate(context, '/content/templates/base-loader.html'),
  ]);

  // Inject
  html = html.replace(/<!--\s*INJECT:BASE-HEAD\s*-->/g, headTemplate);
  html = html.replace(/<!--\s*INJECT:BASE-LOADER\s*-->/g, loaderTemplate);

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
