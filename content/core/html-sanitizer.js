/**
 * HTML Sanitization Utilities
 * @version 2.0.0
 */

/**
 * Escapes HTML special characters (for plain text display)
 */
export function escapeHTML(text) {
  if (!text || typeof text !== 'string') return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
