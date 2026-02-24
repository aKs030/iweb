/**
 * Search Query Utilities
 * Parsing and regex compilation.
 * Reduced version: Relies on AI for synonyms and expansion.
 */

/**
 * Parse a positive integer or return null.
 * @param {unknown} value
 * @returns {number | null}
 */
export function parsePositiveInteger(value) {
  const normalized = String(value ?? '').trim();
  if (!/^\d+$/.test(normalized)) return null;
  const parsed = Number.parseInt(normalized, 10);
  return parsed > 0 ? parsed : null;
}

/**
 * Clamp a number into a fixed range.
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Convert query string into normalized terms.
 * @param {string} query
 * @returns {string[]}
 */
export function toQueryTerms(query) {
  return String(query)
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length > 1);
}

/**
 * Compile regexes for query terms to avoid recompilation in loops.
 * @param {string[]} queryTerms
 * @returns {RegExp[]}
 */
export function compileQueryRegexes(queryTerms) {
  if (!queryTerms || queryTerms.length === 0) return [];
  const boundaryRe = (term) =>
    new RegExp(
      `(^|[\\s/\\-_.])${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
      'i',
    );
  return queryTerms.map(boundaryRe);
}

/**
 * Expand query - Simplified to identity function as AI handles synonyms.
 * Kept for interface compatibility.
 * @param {string} query
 * @returns {string}
 */
export function expandQuery(query) {
  return String(query || '').trim();
}
