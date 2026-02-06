/**
 * Shared Response Utilities
 * Standardized response helpers with domain-restricted CORS
 */

const ALLOWED_ORIGINS = [
  'https://abdulkerimsesli.de',
  'https://www.abdulkerimsesli.de',
];

/** @param {Request} [request] */
function getCorsHeaders(request) {
  const origin = request?.headers?.get('Origin') || '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin)
    ? origin
    : ALLOWED_ORIGINS[0];

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

/**
 * JSON response with CORS headers
 * @param {Object} data
 * @param {number} [status=200]
 * @param {Object} [extra={}] - Additional headers
 * @param {Request} [request] - Original request (for Origin check)
 */
export function jsonResponse(data, status = 200, extra = {}, request) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...getCorsHeaders(request),
      ...extra,
    },
  });
}

/**
 * Structured error response
 * @param {string} error
 * @param {string} [message]
 * @param {number} [status=500]
 * @param {Request} [request]
 */
export function errorResponse(error, message, status = 500, request) {
  return jsonResponse(
    { error, status, ...(message && { message }) },
    status,
    {},
    request,
  );
}

/**
 * CORS preflight response
 * @param {Request} [request]
 */
export function handleCORSPreflight(request) {
  return new Response(null, { status: 204, headers: getCorsHeaders(request) });
}
