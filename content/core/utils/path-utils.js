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
  if (!path) return "/";

  let normalized = String(path).trim();
  if (!normalized.startsWith("/")) {
    normalized = "/" + normalized;
  }

  if (normalized.endsWith("/index.html")) {
    normalized = normalized.substring(0, normalized.length - 11);
  } else if (normalized.endsWith(".html")) {
    normalized = normalized.substring(0, normalized.length - 5);
  }

  if (normalized === "") {
    return "/";
  }

  if (normalized !== "/" && normalized.endsWith("/")) {
    normalized = normalized.slice(0, -1);
  }

  return normalized;
}

/**
 * Normalize pathname by removing query strings, hashes, multiple slashes, and trailing slashes
 * Used for route matching and canonical path normalization
 * @param {string|null|undefined} pathname - Pathname to normalize
 * @returns {string} Normalized pathname (or "/" if empty)
 */
export function normalizePathname(pathname) {
  const source = String(pathname || "/");
  // Remove query string and hash
  const noQuery = source.split("?")[0] || "";
  const noHash = noQuery.split("#")[0] || "";
  // Normalize multiple slashes to single slash
  const normalized = noHash.replace(/\/+/g, "/");
  // Remove trailing slashes (except root "/")
  return normalized === "" || normalized === "/" ? "/" : normalized.replace(/\/$/, "");
}
