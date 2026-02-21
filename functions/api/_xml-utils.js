/**
 * XML Utilities - Shared functions for sitemap generation
 * @version 1.0.0
 */

/**
 * Escape special XML characters
 * @param {string} value - Text to escape
 * @returns {string} XML-safe text
 */
export function escapeXml(value) {
  return String(value ?? '').replace(/[<>&'"]/g, (char) => {
    switch (char) {
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '&':
        return '&amp;';
      case "'":
        return '&apos;';
      case '"':
        return '&quot;';
      default:
        return char;
    }
  });
}

/**
 * Normalize URL path
 * @param {string} path - URL path to normalize
 * @returns {string} Normalized path
 */
export function normalizePath(path) {
  if (!path) return '/';
  if (path === '/') return '/';

  let normalized = String(path).trim();
  if (!normalized.startsWith('/')) normalized = '/' + normalized;
  normalized = normalized.replace(/\/index\.html?$/i, '/');
  if (!normalized.endsWith('/')) normalized += '/';

  return normalized;
}

/**
 * Resolve origin URL with www prefix
 * @param {string} requestUrl - Request URL
 * @returns {string} Origin with www prefix
 */
export function resolveOrigin(requestUrl) {
  const url = new URL(requestUrl);
  if (url.hostname === 'abdulkerimsesli.de') {
    url.hostname = 'www.abdulkerimsesli.de';
  }
  return url.origin;
}

/**
 * Convert to ISO date string
 * @param {string|Date} value - Date value
 * @returns {string|null} ISO date string or null
 */
export function toISODate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().split('T')[0];
}

/**
 * Convert to absolute URL
 * @param {string} origin - Origin URL
 * @param {string} value - Relative or absolute URL
 * @returns {string} Absolute URL
 */
export function toAbsoluteUrl(origin, value) {
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;

  const path = value.startsWith('/') ? value : `/${value}`;
  return `${origin}${path}`;
}
