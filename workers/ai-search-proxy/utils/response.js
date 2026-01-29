/**
 * Response Utilities
 * Standardized response helpers for consistent API responses
 */

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

/**
 * Creates a JSON response with CORS headers
 */
export function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
    },
  });
}

/**
 * Creates an error response
 */
export function errorResponse(message, status = 500) {
  return jsonResponse(
    {
      error: message,
      status,
      timestamp: new Date().toISOString(),
    },
    status,
  );
}
