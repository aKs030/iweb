import { mergeHeaders } from '../_shared/http-headers.js';

const DEFAULT_JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
};

/**
 * @param {Headers | Record<string, string> | undefined | null} headers
 * @returns {Headers}
 */
function createHeaders(headers) {
  return mergeHeaders(DEFAULT_JSON_HEADERS, headers);
}

/**
 * @param {unknown} payload
 * @param {{ headers?: Headers | Record<string, string>, status?: number }} [options]
 * @returns {Response}
 */
export function jsonResponse(payload, options = {}) {
  return new Response(JSON.stringify(payload), {
    status: options.status || 200,
    headers: createHeaders(options.headers),
  });
}

/**
 * @param {string | Record<string, unknown>} error
 * @param {{ code?: string, headers?: Headers | Record<string, string>, status?: number }} [options]
 * @returns {Response}
 */
export function errorJsonResponse(error, options = {}) {
  /** @type {Record<string, unknown>} */
  const payload = typeof error === 'string' ? { error } : { ...error };
  if (options.code && !('code' in payload)) {
    payload.code = options.code;
  }

  return jsonResponse(payload, {
    status: options.status || 500,
    headers: options.headers,
  });
}
