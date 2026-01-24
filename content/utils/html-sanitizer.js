/**
 * HTML Sanitization Utilities
 * Provides safe HTML rendering to prevent XSS attacks
 *
 * @module html-sanitizer
 * @version 1.0.0
 */

import DOMPurify from 'dompurify';

/**
 * Default DOMPurify configuration for general content
 */
const DEFAULT_CONFIG = {
  ALLOWED_TAGS: [
    'b',
    'i',
    'em',
    'strong',
    'a',
    'p',
    'br',
    'span',
    'div',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'ul',
    'ol',
    'li',
    'code',
    'pre',
    'blockquote',
    'small',
  ],
  ALLOWED_ATTR: [
    'href',
    'target',
    'rel',
    'class',
    'id',
    'title',
    'data-*', // Allow data attributes
  ],
  ALLOW_DATA_ATTR: true,
  RETURN_DOM: false,
  RETURN_DOM_FRAGMENT: false,
};

/**
 * Strict configuration for user-generated content
 */
const STRICT_CONFIG = {
  ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
  ALLOWED_ATTR: ['href', 'target', 'rel'],
  ALLOW_DATA_ATTR: false,
};

/**
 * Minimal configuration for plain text with basic formatting
 */
const MINIMAL_CONFIG = {
  ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'br'],
  ALLOWED_ATTR: [],
  ALLOW_DATA_ATTR: false,
  KEEP_CONTENT: true, // Keep text content when removing tags
};

/**
 * Sanitizes HTML content to prevent XSS attacks
 *
 * @param {string} html - The HTML string to sanitize
 * @param {Object} [config] - Optional DOMPurify configuration
 * @returns {string} Sanitized HTML string
 *
 * @example
 * const safe = sanitizeHTML('<script>alert("xss")</script><p>Hello</p>');
 * // Returns: '<p>Hello</p>'
 */
export function sanitizeHTML(html, config = DEFAULT_CONFIG) {
  if (!html || typeof html !== 'string') {
    return '';
  }

  try {
    return DOMPurify.sanitize(html, config);
  } catch (error) {
    console.error('HTML sanitization failed:', error);
    return ''; // Return empty string on error (fail-safe)
  }
}

/**
 * Sanitizes HTML with strict rules (for user-generated content)
 *
 * @param {string} html - The HTML string to sanitize
 * @returns {string} Sanitized HTML string
 *
 * @example
 * const safe = sanitizeHTMLStrict('<a href="javascript:alert()">Click</a>');
 * // Returns: '<a>Click</a>' (href removed)
 */
export function sanitizeHTMLStrict(html) {
  return sanitizeHTML(html, STRICT_CONFIG);
}

/**
 * Sanitizes HTML with minimal formatting (basic text styling only)
 *
 * @param {string} html - The HTML string to sanitize
 * @returns {string} Sanitized HTML string
 *
 * @example
 * const safe = sanitizeHTMLMinimal('<b>Bold</b><script>alert()</script>');
 * // Returns: '<b>Bold</b>'
 */
export function sanitizeHTMLMinimal(html) {
  return sanitizeHTML(html, MINIMAL_CONFIG);
}

/**
 * Safely sets innerHTML on an element
 *
 * @param {HTMLElement} element - The target element
 * @param {string} html - The HTML string to set
 * @param {Object} [config] - Optional DOMPurify configuration
 *
 * @example
 * const div = document.getElementById('content');
 * safeSetInnerHTML(div, '<p>Safe content</p>');
 */
export function safeSetInnerHTML(element, html, config = DEFAULT_CONFIG) {
  if (!element || !(element instanceof HTMLElement)) {
    console.error('safeSetInnerHTML: Invalid element provided');
    return;
  }

  const sanitized = sanitizeHTML(html, config);
  element.innerHTML = sanitized;
}

/**
 * Escapes HTML special characters (for plain text display)
 * Use this when you want to display user input as text, not HTML
 *
 * @param {string} text - The text to escape
 * @returns {string} Escaped text
 *
 * @example
 * const escaped = escapeHTML('<script>alert("xss")</script>');
 * // Returns: '&lt;script&gt;alert("xss")&lt;/script&gt;'
 */
export function escapeHTML(text) {
  if (!text || typeof text !== 'string') {
    return '';
  }

  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Strips all HTML tags from a string
 *
 * @param {string} html - The HTML string
 * @returns {string} Plain text without HTML tags
 *
 * @example
 * const text = stripHTML('<p>Hello <b>World</b></p>');
 * // Returns: 'Hello World'
 */
export function stripHTML(html) {
  if (!html || typeof html !== 'string') {
    return '';
  }

  // Use DOMPurify to sanitize first (removes dangerous content)
  const sanitized = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [],
    KEEP_CONTENT: true,
  });

  // Then use a simple regex to remove any remaining tags
  // and clean up extra whitespace
  return sanitized
    .replace(/<[^>]*>/g, '') // Remove all HTML tags
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

/**
 * Validates if a URL is safe (no javascript:, data:, etc.)
 *
 * @param {string} url - The URL to validate
 * @returns {boolean} True if URL is safe
 *
 * @example
 * isSafeURL('https://example.com'); // true
 * isSafeURL('javascript:alert()'); // false
 */
export function isSafeURL(url) {
  if (!url || typeof url !== 'string') {
    return false;
  }

  const trimmed = url.trim().toLowerCase();

  // Block dangerous protocols
  const dangerousProtocols = ['javascript:', 'data:', 'vbscript:', 'file:'];

  for (const protocol of dangerousProtocols) {
    if (trimmed.startsWith(protocol)) {
      return false;
    }
  }

  return true;
}

// Export configurations for advanced usage
export const CONFIGS = {
  DEFAULT: DEFAULT_CONFIG,
  STRICT: STRICT_CONFIG,
  MINIMAL: MINIMAL_CONFIG,
};

export default {
  sanitizeHTML,
  sanitizeHTMLStrict,
  sanitizeHTMLMinimal,
  safeSetInnerHTML,
  escapeHTML,
  stripHTML,
  isSafeURL,
  CONFIGS,
};
