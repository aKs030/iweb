/**
 * API Middleware - Rate Limiting & Security
 * Uses Cloudflare KV for distributed rate limiting across isolates.
 * Falls back to in-memory Map when KV is unavailable (local dev).
 * @version 2.0.0
 */

// Rate limiting configuration
const RATE_LIMIT = {
  WINDOW_S: 60, // 1 minute (seconds, for KV TTL)
  MAX_REQUESTS: 30, // 30 requests per minute per IP
  MAX_REQUESTS_STRICT: 10, // 10 requests per minute for AI endpoints
};

// ── In-memory fallback (dev / KV unavailable) ──────────────────────
const _mem = new Map();
let _lastCleanup = Date.now();

function checkInMemory(identifier, maxRequests) {
  const now = Date.now();
  const windowMs = RATE_LIMIT.WINDOW_S * 1000;

  // Periodic cleanup
  if (now - _lastCleanup > 300_000) {
    _lastCleanup = now;
    if (_mem.size > 10_000) {
      _mem.clear();
    } else {
      for (const [k, d] of _mem) {
        if (now - d.resetTime > windowMs) _mem.delete(k);
      }
    }
  }

  const data = _mem.get(identifier);
  if (!data || now - data.resetTime > windowMs) {
    _mem.set(identifier, { count: 1, resetTime: now });
    return { allowed: true, remaining: maxRequests - 1 };
  }
  if (data.count >= maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      retryAfter: Math.ceil((windowMs - (now - data.resetTime)) / 1000),
    };
  }
  data.count++;
  return { allowed: true, remaining: maxRequests - data.count };
}

// ── KV-backed rate limiter (distributed) ───────────────────────────
async function checkKV(kv, identifier, maxRequests) {
  const key = `rl:${identifier}`;
  try {
    const raw = await kv.get(key);
    const count = raw ? Number.parseInt(raw, 10) || 0 : 0;

    if (count >= maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        retryAfter: RATE_LIMIT.WINDOW_S,
      };
    }

    // Increment – TTL auto-expires the key after the window
    await kv.put(key, String(count + 1), {
      expirationTtl: RATE_LIMIT.WINDOW_S,
    });

    return { allowed: true, remaining: maxRequests - count - 1 };
  } catch {
    // KV failure → degrade to in-memory
    return checkInMemory(identifier, maxRequests);
  }
}

/**
 * Get client identifier (IP address)
 */
function getClientIdentifier(request) {
  const cfIP = request.headers.get('CF-Connecting-IP');
  if (cfIP) return cfIP;

  const forwarded = request.headers.get('X-Forwarded-For');
  if (forwarded) return forwarded.split(',')[0].trim();

  return 'unknown';
}

/**
 * Middleware for rate limiting
 */
export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);

  // Skip rate limiting for OPTIONS requests
  if (request.method === 'OPTIONS') {
    return next();
  }

  const clientId = getClientIdentifier(request);

  const isAIEndpoint = url.pathname.includes('/ai');
  const maxRequests = isAIEndpoint
    ? RATE_LIMIT.MAX_REQUESTS_STRICT
    : RATE_LIMIT.MAX_REQUESTS;

  // Use KV when available (production), else fall back to in-memory
  const result = env?.RATE_LIMIT_KV
    ? await checkKV(env.RATE_LIMIT_KV, clientId, maxRequests)
    : checkInMemory(clientId, maxRequests);

  const headers = {
    'X-RateLimit-Limit': maxRequests.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
  };

  if (!result.allowed) {
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
