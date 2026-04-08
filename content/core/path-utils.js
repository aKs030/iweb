/**
 * Path Utilities - Centralized URL and path manipulation
 * @version 1.0.0
 */

// ============================================================================
// PATH NORMALIZATION
// ============================================================================

/**
 * Canonicalize URL path (remove .html, trailing slashes, etc.)
 * @param {string|null|undefined} path - Path to canonicalize
 * @returns {string} Canonicalized path
 */
export function canonicalizeUrlPath(path) {
  if (!path) return '/';

  let normalized = String(path).trim();
  if (!normalized.startsWith('/')) {
    normalized = '/' + normalized;
  }

  if (normalized.endsWith('/index.html')) {
    normalized = normalized.substring(0, normalized.length - 11);
  } else if (normalized.endsWith('.html')) {
    normalized = normalized.substring(0, normalized.length - 5);
  }

  if (normalized === '') {
    return '/';
  }

  if (normalized !== '/' && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }

  return normalized;
}

/**
 * Normalize URL path (alias for canonicalizeUrlPath)
 * @param {string|null|undefined} path - Path to normalize
 * @returns {string} Normalized path
 */
export function normalizePath(path) {
  return canonicalizeUrlPath(path);
}
