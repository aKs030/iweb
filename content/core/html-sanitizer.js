/**
 * HTML Sanitization Utilities
 * @version 3.0.0
 * Uses simple escaping for robust XSS prevention where full HTML is not needed.
 */

/**
 * Escapes HTML special characters (for plain text display)
 */
import DOMPurify from 'https://cdn.jsdelivr.net/npm/dompurify@3.3.1/dist/purify.es.mjs';

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

/**
 * Sanitize HTML using DOMPurify with a sensible default config.
 * Use this central wrapper instead of importing DOMPurify directly in pages.
 */
export function sanitizeHTML(html, options = {}) {
  if (html == null) return '';
  try {
    return DOMPurify.sanitize(String(html), options);
  } catch (err) {
    // Fallback to escaping if DOMPurify fails for any reason
    return escapeHTML(String(html));
  }
}
