/**
 * API Middleware - Rate Limiting & Security
 * Uses Cloudflare KV for distributed rate limiting across isolates.
 * Falls back to in-memory Map when KV is unavailable (local dev).
 * @version 2.0.0
 */

import { getCorsHeaders } from './_cors.js';
import { createWindowRateLimiter } from './_rate-limit.js';
import { getRequestClientIp } from './_request-utils.js';
import { errorJsonResponse } from './_response.js';
import {
  CACHE_CONTROL_NO_STORE,
  mergeHeaders,
} from '../_shared/http-headers.js';

// Rate limiting configuration
const RATE_LIMIT = {
  WINDOW_S: 60, // 1 minute (seconds, for KV TTL)
  MAX_REQUESTS: 30, // 30 requests per minute per IP
  MAX_REQUESTS_STRICT: 30, // 30 requests per minute for AI endpoints
};

const rateLimiter = createWindowRateLimiter({
  keyNamespace: 'rl:v2',
  maxEntries: 10_000,
});

/**
 * Middleware for rate limiting
 */
export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const isLocalhostRequest =
    url.hostname === 'localhost' ||
    url.hostname === '127.0.0.1' ||
    url.hostname === '::1' ||
    url.hostname === '[::1]';
  const isAdminSessionRoute = url.pathname === '/api/admin/session';

  // Keep local dev and admin-session bootstrap free from middleware throttling.
  if (isLocalhostRequest || isAdminSessionRoute) {
    return next();
  }

  // Skip rate limiting for OPTIONS requests
  if (request.method === 'OPTIONS') {
    return next();
  }

  const clientId = getRequestClientIp(request, {
    allowForwarded: false,
  });

  const isAIEndpoint = url.pathname.includes('/ai');
  const maxRequests = isAIEndpoint
    ? RATE_LIMIT.MAX_REQUESTS_STRICT
    : RATE_LIMIT.MAX_REQUESTS;

  // Use KV when available (production), else fall back to in-memory
  const result = await rateLimiter.check(clientId, {
    kv: env?.RATE_LIMIT_KV,
    limit: maxRequests,
    windowSeconds: RATE_LIMIT.WINDOW_S,
  });

  const headers = {
    'X-RateLimit-Limit': maxRequests.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
  };

  if (!result.allowed) {
    return errorJsonResponse(
      {
        error: 'Rate limit exceeded',
        message: `Too many requests. Please try again in ${result.retryAfter} seconds.`,
        retryAfter: result.retryAfter,
      },
      {
        status: 429,
        headers: mergeHeaders(getCorsHeaders(request, env), headers, {
          'Retry-After': result.retryAfter.toString(),
          'Cache-Control': CACHE_CONTROL_NO_STORE,
        }),
      },
    );
  }

  const response = await next();

  const newHeaders = new Headers(response.headers);
  for (const [key, value] of Object.entries(headers)) {
    newHeaders.set(key, value);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}
