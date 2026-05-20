import { mergeHeaders, CACHE_CONTROL_PRIVATE_NO_STORE } from "../_shared/http-headers.js";

const DEFAULT_JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
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
  const payload = typeof error === "string" ? { error } : { ...error };
  if (options.code && !("code" in payload)) {
    payload.code = options.code;
  }

  return jsonResponse(payload, {
    status: options.status || 500,
    headers: options.headers,
  });
}

// ---------------------------------------------------------------------------
// CORS-aware convenience helpers (merge CORS + no-store + extra headers)
// ---------------------------------------------------------------------------

/**
 * @param {Headers | Record<string, string>} corsHeaders
 * @param {unknown} payload
 * @param {number} [status]
 * @param {Record<string, string>} [extraHeaders]
 * @returns {Response}
 */
export function corsJsonResponse(corsHeaders, payload, status = 200, extraHeaders = {}) {
  return jsonResponse(payload, {
    status,
    headers: mergeHeaders(corsHeaders, { "Cache-Control": CACHE_CONTROL_PRIVATE_NO_STORE }, extraHeaders),
  });
}

/**
 * @param {Headers | Record<string, string>} corsHeaders
 * @param {string | Record<string, unknown>} error
 * @param {number} [status]
 * @param {Record<string, string>} [extraHeaders]
 * @returns {Response}
 */
export function corsErrorResponse(corsHeaders, error, status = 500, extraHeaders = {}) {
  return errorJsonResponse(error, {
    status,
    headers: mergeHeaders(corsHeaders, { "Cache-Control": CACHE_CONTROL_PRIVATE_NO_STORE }, extraHeaders),
  });
}
