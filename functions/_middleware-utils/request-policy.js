import {
  buildProjectDetailPath,
  extractProjectSlug,
  isProjectIndexPath,
} from '../../content/core/project-paths.js';
import { FAVICON_ICO_URL } from '../../content/config/media-urls.js';

const CONDITIONAL_REQUEST_HEADERS = ['If-Modified-Since', 'If-None-Match'];
const LEGACY_FAVICON_PATHS = new Set(['/favicon.ico', '/favicon.svg']);
const FAVICON_REDIRECT_TARGET = FAVICON_ICO_URL;

/**
 * @param {URL} url
 * @returns {Response | null}
 */
export function resolveRequestRedirect(url) {
  if (LEGACY_FAVICON_PATHS.has(url.pathname)) {
    return new Response(null, {
      status: 302,
      headers: {
        Location: FAVICON_REDIRECT_TARGET,
        'Cache-Control': 'public, max-age=86400',
      },
    });
  }

  if (url.hostname === 'abdulkerimsesli.de') {
    url.hostname = 'www.abdulkerimsesli.de';
    return Response.redirect(url.href, 301);
  }

  if (isProjectIndexPath(url.pathname)) {
    const legacyAppSlug = extractProjectSlug(url.pathname, url.search);
    if (legacyAppSlug) {
      url.pathname = buildProjectDetailPath(legacyAppSlug);
      url.search = '';
      return Response.redirect(url.href, 301);
    }
  }

  return null;
}

/**
 * Pages HTML gets rewritten at the edge, so upstream conditional requests must
 * not short-circuit to 304 responses with the untransformed asset metadata.
 * Restrict this to actual document-like requests so asset proxies can still
 * honor `If-None-Match` / `If-Modified-Since`.
 *
 * @param {Request} request
 * @param {URL} url
 * @returns {Request}
 */
export function prepareDocumentUpstreamRequest(request, url) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return request;
  }

  const pathname = String(url?.pathname || '');
  const accept = String(request.headers.get('Accept') || '').toLowerCase();
  const isDocumentLikeRequest =
    accept.includes('text/html') ||
    pathname === '/' ||
    pathname.endsWith('.html') ||
    !/\.[a-z0-9]+$/i.test(pathname);

  if (
    !isDocumentLikeRequest ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/r2-proxy/')
  ) {
    return request;
  }

  const headers = new Headers(request.headers);
  let mutated = false;

  for (const headerName of CONDITIONAL_REQUEST_HEADERS) {
    if (headers.has(headerName)) {
      headers.delete(headerName);
      mutated = true;
    }
  }

  if (!mutated) {
    return request;
  }

  return new Request(request, { headers });
}
