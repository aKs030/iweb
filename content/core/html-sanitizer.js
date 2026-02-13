/**
 * HTML Sanitization Utilities
 * @version 3.0.0
 * Uses simple escaping for robust XSS prevention where full HTML is not needed.
 */

/**
 * Escapes HTML special characters (for plain text display)
 */
const HTML_ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};
const ESCAPE_RE = /[&<>"']/g;

export function escapeHTML(text) {
  if (!text || typeof text !== 'string') return '';
  return text.replace(ESCAPE_RE, (c) => HTML_ESCAPES[c]);
}
