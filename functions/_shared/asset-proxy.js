import {
  CACHE_CONTROL_NOT_FOUND_SHORT as DEFAULT_NOT_FOUND_CACHE_CONTROL,
  CACHE_CONTROL_PROXY_DEFAULT as DEFAULT_PROXY_CACHE_CONTROL,
} from './http-headers.js';
const CONDITIONAL_HEADER_NAMES = [
  'Cache-Control',
  'Content-Type',
  'ETag',
  'Last-Modified',
  'X-Robots-Tag',
];
const CONDITIONAL_REQUEST_HEADER_NAMES = ['If-None-Match', 'If-Modified-Since'];

/**
 * @param {string | null | undefined} rawPath
 * @param {{
 *   defaultDocument?: string,
 *   filterEmptySegments?: boolean,
 * }} [options]
 * @returns {string}
 */
export function normalizeEncodedProxyPath(rawPath, options = {}) {
  const defaultDocument = String(options.defaultDocument || '');
  const filterEmptySegments = options.filterEmptySegments !== false;
  const normalizedSource = String(rawPath || '').replace(/^\/+/, '');
  const pathname =
    !normalizedSource || normalizedSource.endsWith('/')
      ? `${normalizedSource}${defaultDocument}`
      : normalizedSource;

  if (!pathname || pathname.includes('..')) {
    return '';
  }

  try {
    const segments = pathname.split('/');
    return (filterEmptySegments ? segments.filter(Boolean) : segments)
      .map((segment) => encodeURIComponent(decodeURIComponent(segment)))
      .join('/');
  } catch {
    return '';
  }
}

/**
 * @param {string | null | undefined} proxyPath
 * @returns {string}
 */
export function decodeProxyPath(proxyPath) {
  return String(proxyPath || '')
    .split('/')
    .map((segment) => decodeURIComponent(segment))
    .join('/');
}

/**
 * @param {string} pathname
 * @param {Map<string, string>} contentTypes
 * @param {Headers | null | undefined} [sourceHeaders]
 * @returns {string}
 */
export function inferProxyContentType(pathname, contentTypes, sourceHeaders) {
  const extensionMatch = String(pathname || '').match(/(\.[A-Za-z0-9]+)$/);
  const mappedType =
    extensionMatch && contentTypes.get(extensionMatch[1].toLowerCase());

  return (
    mappedType ||
    sourceHeaders?.get('content-type') ||
    'application/octet-stream'
  );
}

/**
 * @param {{
 *   pathname: string,
 *   contentTypes: Map<string, string>,
 *   sourceHeaders?: Headers | null,
 *   cacheControl?: string,
 *   extraHeaders?: Record<string, string>,
 * }} options
 * @returns {Headers}
 */
export function buildProxyResponseHeaders(options) {
  const headers = new Headers();
  headers.set(
    'Content-Type',
    inferProxyContentType(
      options.pathname,
      options.contentTypes,
      options.sourceHeaders,
    ),
  );
  headers.set(
    'Cache-Control',
    options.cacheControl || DEFAULT_PROXY_CACHE_CONTROL,
  );

  const etag = options.sourceHeaders?.get('etag');
  if (etag) headers.set('ETag', etag);

  const lastModified = options.sourceHeaders?.get('last-modified');
  if (lastModified) headers.set('Last-Modified', lastModified);

  for (const [headerName, headerValue] of Object.entries(
    options.extraHeaders || {},
  )) {
    headers.set(headerName, headerValue);
  }

  return headers;
}

/**
 * @param {URL} url
 * @returns {Request}
 */
export function buildProxyCacheKey(url) {
  return new Request(url.toString(), { method: 'GET' });
}

/**
 * @param {string | null | undefined} etag
 * @returns {string}
 */
function normalizeEtag(etag) {
  return String(etag || '')
    .trim()
    .replace(/^W\//i, '')
    .replace(/^"(.*)"$/, '$1');
}

/**
 * @param {string | null} ifNoneMatch
 * @param {string | null} etag
 * @returns {boolean}
 */
function matchesIfNoneMatch(ifNoneMatch, etag) {
  if (!ifNoneMatch || !etag) return false;
  const expectedEtag = normalizeEtag(etag);

  return ifNoneMatch
    .split(',')
    .map((value) => value.trim())
    .some((value) => value === '*' || normalizeEtag(value) === expectedEtag);
}

/**
 * @param {string | null} ifModifiedSince
 * @param {string | null} lastModified
 * @returns {boolean}
 */
function matchesIfModifiedSince(ifModifiedSince, lastModified) {
  if (!ifModifiedSince || !lastModified) return false;

  const modifiedSinceMs = Date.parse(ifModifiedSince);
  const lastModifiedMs = Date.parse(lastModified);
  if (Number.isNaN(modifiedSinceMs) || Number.isNaN(lastModifiedMs)) {
    return false;
  }

  return lastModifiedMs <= modifiedSinceMs;
}

/**
 * @param {Request} request
 * @param {Headers} headers
 * @param {string} cacheHeaderName
 * @param {string} cacheStatus
 * @returns {Response | null}
 */
export function maybeBuildNotModifiedResponse(
  request,
  headers,
  cacheHeaderName,
  cacheStatus,
) {
  const ifNoneMatch = request.headers.get('If-None-Match');
  const ifModifiedSince = request.headers.get('If-Modified-Since');
  const etag = headers.get('ETag');
  const lastModified = headers.get('Last-Modified');

  if (
    !matchesIfNoneMatch(ifNoneMatch, etag) &&
    !matchesIfModifiedSince(ifModifiedSince, lastModified)
  ) {
    return null;
  }

  return new Response(null, {
    status: 304,
    headers: buildNotModifiedHeaders(headers, cacheHeaderName, cacheStatus),
  });
}

/**
 * @param {Headers} headers
 * @param {string} cacheHeaderName
 * @param {string} cacheStatus
 * @returns {Headers}
 */
export function buildNotModifiedHeaders(headers, cacheHeaderName, cacheStatus) {
  const responseHeaders = new Headers();
  for (const headerName of CONDITIONAL_HEADER_NAMES) {
    const headerValue = headers.get(headerName);
    if (headerValue) {
      responseHeaders.set(headerName, headerValue);
    }
  }
  responseHeaders.set(cacheHeaderName, cacheStatus);
  return responseHeaders;
}

/**
 * @param {Request} request
 * @param {Record<string, string>} [extraHeaders]
 * @returns {Headers}
 */
export function buildConditionalProxyRequestHeaders(
  request,
  extraHeaders = {},
) {
  const headers = new Headers(extraHeaders);

  for (const headerName of CONDITIONAL_REQUEST_HEADER_NAMES) {
    const headerValue = request.headers.get(headerName);
    if (headerValue) {
      headers.set(headerName, headerValue);
    }
  }

  return headers;
}

/**
 * @param {URL} url
 * @param {{
 *   cacheHeaderName: string,
 *   includeBody: boolean,
 *   request: Request,
 * }} options
 * @returns {Promise<Response | null>}
 */
export async function matchAssetProxyCache(url, options) {
  try {
    const cached = await caches.default.match(buildProxyCacheKey(url));
    if (!cached) return null;

    const cachedHeaders = new Headers(cached.headers);
    const notModified = maybeBuildNotModifiedResponse(
      options.request,
      cachedHeaders,
      options.cacheHeaderName,
      'HIT',
    );
    if (notModified) return notModified;

    cachedHeaders.set(options.cacheHeaderName, 'HIT');
    return new Response(options.includeBody ? cached.body : null, {
      status: cached.status,
      statusText: cached.statusText,
      headers: cachedHeaders,
    });
  } catch {
    return null;
  }
}

/**
 * @param {URL} url
 * @param {Response} response
 * @param {any} context
 */
export function storeAssetProxyCache(url, response, context) {
  try {
    context.waitUntil(caches.default.put(buildProxyCacheKey(url), response));
  } catch {
    // Ignore cache API failures and continue serving the fresh response.
  }
}

/**
 * @param {string} message
 * @param {number} status
 * @returns {Response}
 */
export function buildProxyErrorResponse(message, status) {
  return new Response(message, { status });
}

/**
 * @param {string} message
 * @param {number} [status]
 * @returns {Response}
 */
export function buildProxyNotFoundResponse(message, status = 404) {
  return new Response(message, {
    status,
    headers: {
      'Cache-Control': DEFAULT_NOT_FOUND_CACHE_CONTROL,
    },
  });
}

export { DEFAULT_NOT_FOUND_CACHE_CONTROL, DEFAULT_PROXY_CACHE_CONTROL };
