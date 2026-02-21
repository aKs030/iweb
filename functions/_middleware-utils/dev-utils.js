/**
 * Development Environment Utilities
 * @version 1.0.0
 */

/**
 * Check if hostname is localhost
 * @param {string} hostname - Hostname to check
 * @returns {boolean} True if localhost
 */
export function isLocalhost(hostname) {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname === '[::1]'
  );
}

/**
 * Normalize headers for local development
 * @param {Headers} headers - Response headers
 * @param {string} hostname - Request hostname
 * @returns {boolean} True if headers were modified
 */
export function normalizeLocalDevHeaders(headers, hostname) {
  if (!isLocalhost(hostname)) {
    return false;
  }

  let changed = false;

  if (headers.has('Strict-Transport-Security')) {
    headers.delete('Strict-Transport-Security');
    changed = true;
  }

  const csp = headers.get('Content-Security-Policy');
  if (csp) {
    const sanitized = csp
      .replace(/upgrade-insecure-requests;?\s*/gi, '')
      .replace(/\s{2,}/g, ' ')
      .trim();

    if (sanitized !== csp) {
      headers.set('Content-Security-Policy', sanitized);
      changed = true;
    }
  }

  if (headers.has('Cross-Origin-Embedder-Policy')) {
    headers.delete('Cross-Origin-Embedder-Policy');
    changed = true;
  }

  if (headers.has('Cross-Origin-Opener-Policy')) {
    headers.delete('Cross-Origin-Opener-Policy');
    changed = true;
  }

  return changed;
}
