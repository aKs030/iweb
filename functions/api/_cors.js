/**
 * Shared CORS Utility for Cloudflare Pages Functions
 * Centralizes origin validation and header management.
 * @version 1.0.0
 * Verified existence for deployment: Feb 14, 2026
 */

/**
 * Generates CORS headers based on the request origin and allowed list.
 * @param {Request} request - The incoming request
 * @param {Object} env - Environment variables
 * @returns {Object} Headers object
 */
export function getCorsHeaders(request, env) {
  const origin = request.headers.get('Origin');

  // Get allowed origins from environment variable or use defaults
  // ALLOWED_ORIGINS should be a comma-separated list
  const allowedOrigins = (
    env.ALLOWED_ORIGINS ||
    'https://abdulkerimsesli.de,https://www.abdulkerimsesli.de'
  )
    .split(',')
    .map((o) => o.trim());

  const headers = {
    'Content-Type': 'application/json',
  };

  // Only set CORS headers if the origin is in our whitelist
  if (origin && allowedOrigins.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Credentials'] = 'true';
  }

  return headers;
}

/**
 * Standard handler for OPTIONS preflight requests.
 * @param {Object} context - Cloudflare Pages context
 * @returns {Response} OPTIONS response
 */
export async function handleOptions({ request, env }) {
  const corsHeaders = getCorsHeaders(request, env);

  return new Response(null, {
    status: 204,
    headers: {
      ...corsHeaders,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
}
