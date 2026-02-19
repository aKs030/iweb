/**
 * Cloudflare Pages Middleware — Dynamic HTML Template Injection
 *
 * Injects base-head and base-loader templates into HTML responses.
 *
 * @version 1.3.0
 */

/**
 * Inject templates into HTML
 */
function injectTemplates(html, templates) {
  if (templates.head) {
    html = html.replace(/<!--\s*INJECT:BASE-HEAD\s*-->/g, templates.head);
  }
  if (templates.loader) {
    html = html.replace(/<!--\s*INJECT:BASE-LOADER\s*-->/g, templates.loader);
  }
  return html;
}

/**
 * Load template from URL
 */
async function loadTemplateFromURL(context, path) {
  try {
    const url = new URL(path, context.request.url);
    const response = await context.env.ASSETS.fetch(url);
    if (!response.ok) return '';
    return await response.text();
  } catch (err) {
    console.error(`[middleware] Failed to load template ${path}:`, err);
    return '';
  }
}

/**
 * Middleware entry point — runs on every request.
 * @param {Object} context - Cloudflare Pages context
 */

function isLocalhost(hostname) {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname === '[::1]'
  );
}

function normalizeLocalDevHeaders(headers, hostname) {
  if (!isLocalhost(hostname)) {
    return false;
  }

  let changed = false;

  if (headers.has('Strict-Transport-Security')) {
    headers.delete('Strict-Transport-Security');
    changed = true;
  }

  const csp = headers.get('Content-Security-Policy');
  if (csp) {
    const sanitized = csp
      .replace(/upgrade-insecure-requests;?\s*/gi, '')
      .replace(/\s{2,}/g, ' ')
      .trim();

    if (sanitized !== csp) {
      headers.set('Content-Security-Policy', sanitized);
      changed = true;
    }
  }

  if (headers.has('Cross-Origin-Embedder-Policy')) {
    headers.delete('Cross-Origin-Embedder-Policy');
    changed = true;
  }

  if (headers.has('Cross-Origin-Opener-Policy')) {
    headers.delete('Cross-Origin-Opener-Policy');
    changed = true;
  }

  return changed;
}

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
  } catch (err) {
    console.error('[middleware] context.next() failed:', err);
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

  let html = await response.text();

  // Skip if no markers present
  if (
    !html.includes('INJECT:BASE-HEAD') &&
    !html.includes('INJECT:BASE-LOADER')
  ) {
    return new Response(html, {
      status: response.status,
      statusText: response.statusText,
      headers: initialHeaders,
    });
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
