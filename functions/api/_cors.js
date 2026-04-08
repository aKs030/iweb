/**
 * Shared CORS Utility for Cloudflare Pages Functions
 * Centralizes origin validation and header management.
 * @version 1.0.3
 * Verified existence for deployment: Feb 14, 2026
 */

const DEFAULT_ALLOWED_ORIGINS =
  'https://abdulkerimsesli.de,https://www.abdulkerimsesli.de';
const DEFAULT_ALLOWED_METHODS = 'GET, POST, OPTIONS';
const DEFAULT_ALLOWED_HEADERS = 'Content-Type, X-Jules-User-Id';

/**
 * Generates CORS headers based on the request origin and allowed list.
 * @param {Request} request - The incoming request
 * @param {any} env - Environment variables
 * @returns {Record<string, string>} Headers object
 */
export function getCorsHeaders(request, env) {
  const origin = request.headers.get('Origin');

  // Get allowed origins from environment variable or use defaults
  // ALLOWED_ORIGINS should be a comma-separated list
  const allowedOrigins = (env.ALLOWED_ORIGINS || DEFAULT_ALLOWED_ORIGINS)
    .split(',')
    .map((/** @type {string} */ o) => o.trim());

  /** @type {Record<string, string>} */
  const headers = {};

  // Only set CORS headers if the origin is in our whitelist or is a preview/local environment
  if (origin) {
    let isAllowed = allowedOrigins.includes(origin);

    // Securely check for Cloudflare Pages preview URLs (strictly *.1web.pages.dev)
    if (!isAllowed) {
      // Regex allows https://1web.pages.dev and https://<branch>.1web.pages.dev
      const isPreview = /^https:\/\/(?:[a-z0-9-]+\.)*1web\.pages\.dev$/.test(
        origin,
      );
      if (isPreview) isAllowed = true;
    }

    // Securely check for local development (http://localhost or http://127.0.0.1 with optional port)
    if (!isAllowed) {
      const isLocal = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
      if (isLocal) isAllowed = true;
    }

    if (isAllowed) {
      headers['Access-Control-Allow-Origin'] = origin;
      headers['Access-Control-Allow-Credentials'] = 'true';
      headers.Vary = 'Origin';
    }
  }

  return headers;
}

/**
 * Standard handler for OPTIONS preflight requests.
 * @param {any} context - Cloudflare Pages context
 * @returns {Promise<Response>} OPTIONS response
 */
export async function handleOptions({ request, env }) {
  const corsHeaders = getCorsHeaders(request, env);

  return new Response(null, {
    status: 204,
    headers: {
      ...corsHeaders,
      'Access-Control-Allow-Methods': DEFAULT_ALLOWED_METHODS,
      'Access-Control-Allow-Headers': DEFAULT_ALLOWED_HEADERS,
      'Access-Control-Max-Age': '86400',
    },
  });
}
