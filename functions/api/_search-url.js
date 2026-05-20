/**
 * Search URL Utilities
 * Normalization, canonicalization, and category detection.
 */

import { buildProjectDetailPath, extractProjectSlug } from "../../content/core/project-paths.js";
import { canonicalizeUrlPath } from "../../content/core/utils/path-utils.js";

function extractAppSlugFromUrl(url) {
  try {
    const parsed = new URL(String(url || ""), "https://example.com");
    return extractProjectSlug(parsed.pathname, parsed.search);
  } catch {
    return "";
  }
}

/**
 * Normalize URL to prevent duplicates
 * removes domain/protocol/noisy params and rewrites legacy project queries.
 * @param {string} url - Original URL
 * @returns {string} Normalized URL path
 */
export function normalizeUrl(url) {
  if (!url) return "/";

  let normalized = String(url).replace(/^https?:\/\/[^/]+/i, "");
  if (!normalized.startsWith("/")) {
    normalized = "/" + normalized;
  }

  const hashIndex = normalized.indexOf("#");
  if (hashIndex >= 0) {
    normalized = normalized.slice(0, hashIndex);
  }

  const [rawPath, rawQuery = ""] = normalized.split("?");
  const path = canonicalizeUrlPath(rawPath);
  const appSlug = extractAppSlugFromUrl(`${path}?${rawQuery}`);
  if (appSlug) {
    return buildProjectDetailPath(appSlug);
  }

  return path;
}

function toBasePath(url) {
  const [path] = String(url || "").split("?");
  return canonicalizeUrlPath(path);
}

/**
 * Infer high-level category from URL path.
 * @param {string} url
 * @returns {string}
 */
export function detectCategory(url) {
  const path = toBasePath(url);
  if (path.includes("/projekte")) return "Projekte";
  if (path.includes("/blog")) return "Blog";
  if (path.includes("/gallery")) return "Galerie";
  if (path.includes("/videos")) return "Videos";
  if (path.includes("/about")) return "Über mich";
  if (path.includes("/contact")) return "Kontakt";
  if (path === "/") return "Home";
  return "Seite";
}
