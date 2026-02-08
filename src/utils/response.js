/**
 * Response Utilities mit CORS Support
 */

const ALLOWED_ORIGINS = [
  'https://abdulkerimsesli.de',
  'https://www.abdulkerimsesli.de',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];

/**
 * CORS Headers basierend auf Origin
 */
function getCorsHeaders(request) {
  const origin = request?.headers?.get('Origin') || '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin)
    ? origin
    : ALLOWED_ORIGINS[0];

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

/**
 * JSON Response mit CORS
 */
export function jsonResponse(data, status = 200, extraHeaders = {}, request) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...getCorsHeaders(request),
      ...extraHeaders,
    },
  });
}

/**
 * Error Response
 */
export function errorResponse(error, message, status = 500, request) {
  return jsonResponse(
    {
      error,
      message,
      status,
    },
    status,
    {},
    request,
  );
}

/**
 * CORS Preflight Handler
 */
export function handleCORSPreflight(request) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request),
  });
}
