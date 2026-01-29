/**
 * Rate Limiting Utilities
 * Simple in-memory rate limiting (resets on worker restart)
 */

const rateLimitMap = new Map();

/**
 * Checks if request should be rate limited
 * @param {string} identifier - IP or identifier
 * @param {number} limit - Max requests per minute
 * @returns {boolean} True if rate limited
 */
export function isRateLimited(identifier, limit = 60) {
  const now = Date.now();
  const windowMs = 60000; // 1 minute

  if (!rateLimitMap.has(identifier)) {
    rateLimitMap.set(identifier, { count: 1, resetAt: now + windowMs });
    return false;
  }

  const record = rateLimitMap.get(identifier);

  // Reset window if expired
  if (now > record.resetAt) {
    record.count = 1;
    record.resetAt = now + windowMs;
    return false;
  }

  // Increment counter
  record.count++;

  // Check if over limit
  return record.count > limit;
}

/**
 * Gets rate limit info for identifier
 * @param {string} identifier - IP or identifier
 * @returns {Object} Rate limit info
 */
export function getRateLimitInfo(identifier) {
  const record = rateLimitMap.get(identifier);
  if (!record) {
    return { remaining: 60, resetAt: Date.now() + 60000 };
  }

  return {
    remaining: Math.max(0, 60 - record.count),
    resetAt: record.resetAt,
  };
}
