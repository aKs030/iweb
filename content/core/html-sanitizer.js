/**
 * HTML Sanitization Utilities
 * @version 2.0.0
 */

import DOMPurify from 'dompurify';

const MINIMAL_CONFIG = {
  ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'br'],
  ALLOWED_ATTR: [],
  ALLOW_DATA_ATTR: false,
  KEEP_CONTENT: true,
};

/**
 * Sanitizes HTML with minimal formatting (basic text styling only)
 */
export function sanitizeHTMLMinimal(html) {
  if (!html || typeof html !== 'string') return '';
  try {
    return DOMPurify.sanitize(html, MINIMAL_CONFIG);
  } catch {
    return '';
  }
}

/**
 * Escapes HTML special characters (for plain text display)
 */
export function escapeHTML(text) {
  if (!text || typeof text !== 'string') return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
