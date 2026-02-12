/**
 * API Middleware - Rate Limiting & Security
 * @version 1.0.0
 */

// Rate limiting configuration
const RATE_LIMIT = {
  WINDOW_MS: 60000, // 1 minute
  MAX_REQUESTS: 30, // 30 requests per minute per IP
  MAX_REQUESTS_STRICT: 10, // 10 requests per minute for AI endpoints
};

/**
 * Simple in-memory rate limiter using Map
 * In production, consider using Cloudflare KV or Durable Objects
 */
class RateLimiter {
  constructor() {
    this.requests = new Map();
    // Cleanup old entries every 5 minutes
    setInterval(() => this.cleanup(), 300000);
  }

  cleanup() {
    const now = Date.now();
    for (const [key, data] of this.requests.entries()) {
      if (now - data.resetTime > RATE_LIMIT.WINDOW_MS) {
        this.requests.delete(key);
      }
    }
  }

  check(identifier, maxRequests = RATE_LIMIT.MAX_REQUESTS) {
    const now = Date.now();
    const data = this.requests.get(identifier);

    if (!data || now - data.resetTime > RATE_LIMIT.WINDOW_MS) {
      // New window
      this.requests.set(identifier, {
        count: 1,
        resetTime: now,
      });
      return { allowed: true, remaining: maxRequests - 1 };
    }

    if (data.count >= maxRequests) {
      // Rate limit exceeded
      return {
        allowed: false,
        remaining: 0,
        retryAfter: Math.ceil(
          (RATE_LIMIT.WINDOW_MS - (now - data.resetTime)) / 1000,
        ),
      };
    }

    // Increment counter
    data.count++;
    return { allowed: true, remaining: maxRequests - data.count };
  }
}

const rateLimiter = new RateLimiter();

/**
 * Get client identifier (IP address)
 */
function getClientIdentifier(request) {
  // Try Cloudflare headers first
  const cfIP = request.headers.get('CF-Connecting-IP');
  if (cfIP) return cfIP;

  // Fallback to X-Forwarded-For
  const forwarded = request.headers.get('X-Forwarded-For');
  if (forwarded) return forwarded.split(',')[0].trim();

  // Last resort
  return 'unknown';
}

/**
 * Middleware for rate limiting
 */
export async function onRequest(context) {
  const { request, next } = context;
  const url = new URL(request.url);

  // Skip rate limiting for OPTIONS requests
  if (request.method === 'OPTIONS') {
    return next();
  }

  // Get client identifier
  const clientId = getClientIdentifier(request);

  // Determine rate limit based on endpoint
  const isAIEndpoint = url.pathname.includes('/ai');
  const maxRequests = isAIEndpoint
    ? RATE_LIMIT.MAX_REQUESTS_STRICT
    : RATE_LIMIT.MAX_REQUESTS;

  // Check rate limit
  const result = rateLimiter.check(clientId, maxRequests);

  // Add rate limit headers
  const headers = {
    'X-RateLimit-Limit': maxRequests.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
  };

  if (!result.allowed) {
    // Rate limit exceeded
    return new Response(
      JSON.stringify({
        error: 'Rate limit exceeded',
        message: `Too many requests. Please try again in ${result.retryAfter} seconds.`,
        retryAfter: result.retryAfter,
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': result.retryAfter.toString(),
          ...headers,
        },
      },
    );
  }

  // Continue to next handler
  const response = await next();

  // Add rate limit headers to response
  const newHeaders = new Headers(response.headers);
  Object.entries(headers).forEach(([key, value]) => {
    newHeaders.set(key, value);
  });

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}
