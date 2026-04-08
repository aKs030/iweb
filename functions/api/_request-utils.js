/**
 * Resolve a stable client identifier from common proxy headers.
 * @param {Request} request
 * @param {{ allowForwarded?: boolean }} [options]
 * @returns {string}
 */
export function getRequestClientIp(request, options = {}) {
  const cfIp = request.headers.get('CF-Connecting-IP');
  if (cfIp) return cfIp.trim();

  if (options.allowForwarded !== false) {
    const forwarded = request.headers.get('X-Forwarded-For');
    if (forwarded) {
      const first = forwarded.split(',')[0]?.trim();
      if (first) return first;
    }
  }

  return 'unknown';
}
