/**
 * Shared Response Utilities
 * Standardized response helpers for consistent API responses across workers
 */

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

/**
 * Creates a JSON response with CORS headers
 * @param {Object} data - Response data
 * @param {number} status - HTTP status code
 * @param {Object} additionalHeaders - Additional headers to include
 * @returns {Response} JSON response
 */
export function jsonResponse(data, status = 200, additionalHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
      ...additionalHeaders,
    },
  });
}

/**
 * Creates an error response
 * @param {string} error - Error message
 * @param {string} message - Detailed message
 * @param {number} status - HTTP status code
 * @returns {Response} Error response
 */
export function errorResponse(error, message = null, status = 500) {
  const body = {
    error,
    status,
    timestamp: new Date().toISOString(),
  };

  if (message) {
    body.message = message;
  }

  return jsonResponse(body, status);
}

/**
 * Handles CORS preflight requests
 * @returns {Response} CORS preflight response
 */
export function handleCORSPreflight() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}
