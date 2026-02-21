/**
 * HTML Utilities - Shared HTML processing functions
 * @version 1.0.0
 */

/**
 * Escape HTML entities to prevent XSS
 * @param {string} str - Text to escape
 * @returns {string} HTML-safe text
 */
export function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
