/**
 * Text Utilities - Shared text processing functions
 * @version 1.0.0
 */

/**
 * Normalize text with fallback
 * @param {string} value - Text to normalize
 * @param {string} fallback - Fallback value
 * @returns {string} Normalized text
 */
export function normalizeText(value, fallback = '') {
  const cleaned = String(value ?? '').trim();
  return cleaned || fallback;
}

/**
 * Sanitize discovery text (remove unwanted patterns)
 * @param {string} value - Text to sanitize
 * @param {string} fallback - Fallback value
 * @returns {string} Sanitized text
 */
export function sanitizeDiscoveryText(value, fallback = '') {
  const source = normalizeText(value, fallback);
  if (!source) return '';

  return source
    .replace(/Abdul\s*Berlin/gi, 'Abdulkerim Sesli')
    .replace(/\bBerlin\b/gi, '')
    .replace(/#Abdulberlin/gi, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .trim();
}

/**
 * Format slug to readable text
 * @param {string} slug - Slug to format
 * @returns {string} Formatted text
 */
export function formatSlug(slug = '') {
  return String(slug)
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
