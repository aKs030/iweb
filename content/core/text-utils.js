/**
 * Text Utilities - Centralized text processing functions
 * Consolidates all text normalization, escaping, and sanitization
 * @version 1.0.0
 */

import { SITE_NAME, SITE_OWNER_NAME } from '../config/site-seo.js';

// ============================================================================
// TEXT NORMALIZATION
// ============================================================================

/**
 * Normalize text with optional fallback
 * @param {string|null|undefined} value - Text to normalize
 * @param {string} [fallback=''] - Fallback value
 * @returns {string} Normalized text
 */
export function normalizeText(value, fallback = '') {
  const cleaned = String(value ?? '').trim();
  return cleaned || fallback;
}

/**
 * Normalize text and collapse whitespace
 * @param {string|null|undefined} value - Text to normalize
 * @returns {string} Normalized text with single spaces
 */
export function normalizeSchemaText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalize text for case-insensitive matching
 * @param {string|null|undefined} value - Text to normalize
 * @returns {string} Lowercase normalized text without diacritics
 */
export function normalizeForMatch(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Create unique list from values
 * @param {Array<string>} values - Values to deduplicate
 * @returns {string[]} Unique values
 */
export function uniqueSchemaList(values) {
  const result = [];
  const seen = new Set();

  for (const raw of values || []) {
    const value = normalizeSchemaText(raw);
    if (!value) continue;

    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }

  return result;
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

/**
 * Humanize slug with capitalization
 * @param {string} value - Slug to humanize
 * @returns {string} Humanized text
 */
export function humanizeSlug(value) {
  return String(value || '')
    .replace(/[_+]/g, '-')
    .split('-')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
    .trim();
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
 * Strip branding suffixes from titles
 * @param {string} input - Text to strip
 * @returns {string} Text without branding
 */
export function stripBranding(input) {
  const BRAND_REGEX = new RegExp(
    `\\s*(?:[—–-]\\s*${escapeRegExp(SITE_OWNER_NAME)}|\\|\\s*${escapeRegExp(
      SITE_OWNER_NAME,
    )}|${escapeRegExp(SITE_NAME)})\\s*$`,
    'i',
  );
  return String(input || '')
    .replace(BRAND_REGEX, '')
    .trim();
}

// ============================================================================
// HTML/XML ESCAPING
// ============================================================================

const HTML_ENTITIES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/**
 * Escape HTML entities to prevent XSS
 * @param {string|null|undefined} text - Text to escape
 * @returns {string} HTML-safe text
 */
export function escapeHtml(text) {
  if (!text) return '';
  return String(text).replace(
    /[&<>"']/g,
    (char) => HTML_ENTITIES[char] || char,
  );
}

/**
 * Escape XML special characters
 * @param {string|null|undefined} value - Text to escape
 * @returns {string} XML-safe text
 */
export function escapeXml(value) {
  return String(value ?? '').replace(/[<>&'"]/g, (char) => {
    switch (char) {
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '&':
        return '&amp;';
      case "'":
        return '&apos;';
      case '"':
        return '&quot;';
      default:
        return char;
    }
  });
}

// Alias for backward compatibility
export const escapeHTML = escapeHtml;

// ============================================================================
// REGEX UTILITIES
// ============================================================================

/**
 * Escape special regex characters
 * @param {string|null|undefined} value - Text to escape
 * @returns {string} Regex-safe text
 */
export function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ============================================================================
// URL PATH UTILITIES
// ============================================================================

export { canonicalizeUrlPath, normalizePath } from './path-utils.js';
