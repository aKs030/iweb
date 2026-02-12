/**
 * Cloudflare Pages Middleware
 *
 * Handles host-based redirects (non-www -> www).
 * Template injection is now handled at build time by Vite.
 *
 * @version 2.0.0
 */

/**
 * Middleware entry point — runs on every request.
 * @param {Object} context - Cloudflare Pages context
 */
export async function onRequest(context) {
  const url = new URL(context.request.url);

  // Skip API routes — they have their own handlers
  if (url.pathname.startsWith('/api/')) {
    return await context.next();
  }

  // Redirect non-www → www (301 permanent)
  // Cloudflare Pages _redirects doesn't support host-based redirects.
  if (url.hostname === 'abdulkerimsesli.de') {
    url.hostname = 'www.abdulkerimsesli.de';
    return Response.redirect(url.href, 301);
  }

  // Pass through to the next handler (static asset or function)
  return await context.next();
}
