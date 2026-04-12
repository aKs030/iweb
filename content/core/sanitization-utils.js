/**
 * HTML Sanitization Utilities
 * @version 1.0.0
 */

import { createLogger } from './logger.js';
import { escapeHtml } from './text-utils.js';

const log = createLogger('Sanitization');

const DEFAULT_ALLOWED_TAGS = new Set([
  'a',
  'b',
  'blockquote',
  'br',
  'code',
  'div',
  'em',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'i',
  'img',
  'li',
  'ol',
  'p',
  'pre',
  'small',
  'span',
  'strong',
  'sub',
  'sup',
  'table',
  'tbody',
  'td',
  'th',
  'thead',
  'tr',
  'u',
  'ul',
]);

const DEFAULT_ALLOWED_ATTR = new Set([
  'alt',
  'aria-label',
  'class',
  'decoding',
  'height',
  'href',
  'id',
  'lang',
  'loading',
  'rel',
  'role',
  'src',
  'target',
  'title',
  'width',
]);

const URL_ATTRS = new Set(['href', 'src']);
const SAFE_URL_RE =
  /^(?:https?:|mailto:|tel:|\/|#|data:image\/(?:png|gif|jpeg|jpg|webp|svg\+xml);base64,)/i;

function normalizeSanitizeConfig(options = {}) {
  const allowedTags = new Set(
    Array.isArray(options.ALLOWED_TAGS) && options.ALLOWED_TAGS.length
      ? options.ALLOWED_TAGS
      : [...DEFAULT_ALLOWED_TAGS],
  );
  const allowedAttr = new Set(
    Array.isArray(options.ALLOWED_ATTR) && options.ALLOWED_ATTR.length
      ? options.ALLOWED_ATTR
      : [...DEFAULT_ALLOWED_ATTR],
  );
  return { allowedTags, allowedAttr };
}

function isSafeUrl(value) {
  const normalized = String(value || '').trim();
  if (!normalized) return false;
  return SAFE_URL_RE.test(normalized);
}

function sanitizeAttrValue(name, value) {
  if (!URL_ATTRS.has(name)) return String(value);
  if (!isSafeUrl(value)) return '';
  return String(value);
}

function enforceAnchorRel(el) {
  if (!(el instanceof HTMLAnchorElement)) return;
  if (el.getAttribute('target') !== '_blank') return;
  const rel = String(el.getAttribute('rel') || '')
    .split(/\s+/)
    .filter(Boolean);
  const merged = new Set([...rel, 'noopener', 'noreferrer']);
  el.setAttribute('rel', [...merged].join(' '));
}

function sanitizeNode(node, config) {
  if (!node) return null;

  if (node.nodeType === 3) {
    return document.createTextNode(node.textContent || '');
  }

  if (node.nodeType !== 1) return null;

  const tag = String(node.nodeName || '').toLowerCase();
  if (!config.allowedTags.has(tag)) {
    const fragment = document.createDocumentFragment();
    node.childNodes.forEach((child) => {
      const sanitizedChild = sanitizeNode(child, config);
      if (sanitizedChild) fragment.appendChild(sanitizedChild);
    });
    return fragment;
  }

  const el = document.createElement(tag);
  const attrs = Array.from(node.attributes || []);
  attrs.forEach(({ name, value }) => {
    const attr = String(name || '').toLowerCase();
    if (!attr || attr.startsWith('on')) return;
    if (!config.allowedAttr.has(attr)) return;
    const sanitizedValue = sanitizeAttrValue(attr, value);
    if (!sanitizedValue) return;
    el.setAttribute(attr, sanitizedValue);
  });

  enforceAnchorRel(el);

  node.childNodes.forEach((child) => {
    const sanitizedChild = sanitizeNode(child, config);
    if (sanitizedChild) el.appendChild(sanitizedChild);
  });

  return el;
}

/**
 * Sanitize HTML string
 * @param {string} html - HTML to sanitize
 * @param {Object} [options] - Sanitization options
 * @param {string[]} [options.ALLOWED_TAGS] - Allowed HTML tags
 * @param {string[]} [options.ALLOWED_ATTR] - Allowed attributes
 * @returns {string} Sanitized HTML
 */
export function sanitizeHTML(html, options = {}) {
  if (html == null) return '';
  const source = String(html);
  if (!source) return '';

  if (typeof document === 'undefined') {
    return escapeHtml(source);
  }

  try {
    const template = document.createElement('template');
    template.innerHTML = source;
    const config = normalizeSanitizeConfig(options);
    const out = document.createElement('div');

    template.content.childNodes.forEach((child) => {
      const sanitized = sanitizeNode(child, config);
      if (sanitized) out.appendChild(sanitized);
    });

    return out.innerHTML;
  } catch (err) {
    log.warn('sanitizeHTML failed, returning escaped text', err);
    return escapeHtml(source);
  }
}
