/**
 * HTML Sanitization Utilities
 * @version 3.0.0
 * Uses DOMPurify for robust HTML sanitization
 */

import DOMPurify from 'dompurify';

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

/**
 * Sanitize HTML using DOMPurify
 * @param {string} html - HTML string to sanitize
 * @param {Object} options - DOMPurify configuration options
 * @returns {string} Sanitized HTML
 */
export function sanitizeHTML(html, options = {}) {
  if (!html || typeof html !== 'string') return '';

  const defaultConfig = {
    ALLOWED_TAGS: [
      'b',
      'i',
      'em',
      'strong',
      'a',
      'br',
      'span',
      'p',
      'ul',
      'ol',
      'li',
      'small',
      'sub',
      'sup',
      'code',
      'pre',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'blockquote',
      'div',
    ],
    ALLOWED_ATTR: ['href', 'title', 'class', 'id', 'target', 'rel'],
    ALLOW_DATA_ATTR: false,
    KEEP_CONTENT: true,
    RETURN_DOM: false,
    RETURN_DOM_FRAGMENT: false,
    RETURN_TRUSTED_TYPE: false,
  };

  const config = { ...defaultConfig, ...options };

  try {
    return DOMPurify.sanitize(html, config);
  } catch {
    console.error('HTML sanitization failed');
    // Fallback to escaping
    return escapeHTML(html);
  }
}

/**
 * Sanitize HTML for markdown content (more permissive)
 * @param {string} html - HTML string to sanitize
 * @returns {string} Sanitized HTML
 */
export function sanitizeMarkdown(html) {
  return sanitizeHTML(html, {
    ALLOWED_TAGS: [
      'b',
      'i',
      'em',
      'strong',
      'a',
      'br',
      'span',
      'p',
      'ul',
      'ol',
      'li',
      'code',
      'pre',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'blockquote',
      'hr',
      'img',
      'table',
      'thead',
      'tbody',
      'tr',
      'th',
      'td',
    ],
    ALLOWED_ATTR: [
      'href',
      'title',
      'class',
      'id',
      'target',
      'rel',
      'src',
      'alt',
      'width',
      'height',
    ],
  });
}

/**
 * Strip all HTML tags (text only)
 * @param {string} html - HTML string
 * @returns {string} Plain text
 */
export function stripHTML(html) {
  if (!html || typeof html !== 'string') return '';

  try {
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: [],
      KEEP_CONTENT: true,
    });
  } catch {
    // Fallback to regex
    return html.replace(/<[^>]*>/g, '');
  }
}
