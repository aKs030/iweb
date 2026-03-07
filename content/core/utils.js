/**
 * Core Utilities
 * Central collection of utility functions for DOM, Async and general helpers
 * @version 2.1.0
 * @date 2026-03-01
 */

import { createLogger } from './logger.js';

const log = createLogger('Utils');

// ============================================================================
// ASYNC UTILITIES
// ============================================================================

// ---------------------------------------------------------------------------
// HASH & SCROLL HELPERS
// ---------------------------------------------------------------------------

/**
 * If the current location has no hash, scrolls to the top immediately and
 * schedules a second try after a brief delay. Used on initial load and when
 * restoring from bfcache to avoid Safari oddities.
 */
export function scrollTopIfNoHash() {
  if (!window.location.hash) {
    window.scrollTo(0, 0);
    // some browsers (mobile Safari) require a second call after render
    setTimeout(() => window.scrollTo(0, 0), 100);
  }
}

/**
 * When navigating with the View Transitions API we intercept same-page
 * navigations. This helper determines if a URL points to the same origin
 * and path as the current location, and -- if there is no hash -- performs a
 * smooth scroll to the top. Returns `true` when the navigation is handled
 * (indicating the caller should prevent default behaviour).
 *
 * @param {string} url
 * @returns {boolean}
 */
export function handleSamePageScroll(url) {
  try {
    const parsed = new URL(url, location.origin);
    if (parsed.origin !== location.origin) return false;
    if (
      parsed.pathname === location.pathname &&
      parsed.search === location.search
    ) {
      if (!parsed.hash) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return true;
      }
    }
  } catch {
    // malformed URL
  }
  return false;
}

/**
 * Sleep for specified milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 * @example
 * await sleep(1000); // Wait 1 second
 */
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Debounce a synchronous function
 * @param {Function} fn - Function to debounce
 * @param {number} delay - Delay in milliseconds
 * @param {Object} options - Debounce options
 * @param {boolean} [options.leading=false] - Execute on leading edge
 * @param {boolean} [options.trailing=true] - Execute on trailing edge
 * @returns {Function} Debounced function with cancel method
 * @example
 * const debouncedResize = debounce(handleResize, 300);
 * window.addEventListener('resize', debouncedResize);
 * // Later: debouncedResize.cancel();
 */
export function debounce(fn, delay, options = {}) {
  const { leading = false, trailing = true } = options;
  let timeoutId = null;
  let lastCallTime = 0;

  const debounced = function (...args) {
    const now = Date.now();
    const timeSinceLastCall = now - lastCallTime;

    const execute = () => {
      lastCallTime = now;
      fn.apply(this, args);
    };

    clearTimeout(timeoutId);

    if (leading && timeSinceLastCall > delay) {
      execute();
    }

    if (trailing) {
      timeoutId = setTimeout(() => {
        const elapsed = Date.now() - lastCallTime;
        if (!leading || elapsed >= delay) {
          lastCallTime = Date.now();
          fn.apply(this, args);
        }
      }, delay);
    }
  };

  debounced.cancel = () => {
    clearTimeout(timeoutId);
    timeoutId = null;
  };

  return debounced;
}

/**
 * Throttle a function
 * @param {Function} func - Function to throttle
 * @param {number} limit - Limit in milliseconds
 * @param {Object} options - Throttle options
 * @param {boolean} [options.leading=true] - Execute on leading edge
 * @param {boolean} [options.trailing=true] - Execute on trailing edge
 * @returns {Function} Throttled function with cancel method
 * @example
 * const throttledScroll = throttle(handleScroll, 100);
 * window.addEventListener('scroll', throttledScroll);
 */
export function throttle(func, limit = 250, options = {}) {
  const { leading = true, trailing = true } = options;
  let inThrottle = false;
  let lastArgs = null;
  let timeoutId = null;

  const throttled = function (...args) {
    if (!inThrottle) {
      if (leading) {
        func.apply(this, args);
      }
      inThrottle = true;

      timeoutId = setTimeout(() => {
        inThrottle = false;
        if (trailing && lastArgs) {
          func.apply(this, lastArgs);
          lastArgs = null;
        }
      }, limit);
    } else if (trailing) {
      lastArgs = args;
    }
  };

  throttled.cancel = () => {
    clearTimeout(timeoutId);
    inThrottle = false;
    lastArgs = null;
  };

  return throttled;
}

// ============================================================================
// DOM UTILITIES
// ============================================================================

/**
 * Safe getElementById wrapper
 * @param {string} id - Element ID
 * @returns {HTMLElement|null}
 * @example
 * const header = getElementById('header');
 */
export function getElementById(id) {
  return id ? document.getElementById(id) : null;
}

/**
 * Execute callback when DOM is ready
 * @param {Function} callback - Function to execute
 * @param {Object} [options={ once: true }] - Options for addEventListener
 * @example
 * onDOMReady(() => log.info('DOM ready!'));
 */
export function onDOMReady(callback, options = { once: true }) {
  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      /** @type {EventListener} */ (callback),
      options,
    );
  } else {
    callback();
  }
}

// ============================================================================
// HEAD MANIPULATION
// ============================================================================

/**
 * Upsert a link element in the head
 * @param {Object} [options] - Link attributes
 * @param {string} [options.rel] - Link relation
 * @param {string} [options.href] - Link href
 * @param {string} [options.as] - Resource type for preload
 * @param {string} [options.crossOrigin] - CORS setting
 * @param {Object} [options.dataset] - Data attributes
 * @param {string} [options.id] - Element ID
 * @param {Object} [options.attrs] - Additional attributes
 * @param {Function} [options.onload] - Onload callback
 * @returns {HTMLLinkElement|null}
 * @example
 * upsertHeadLink({ rel: 'stylesheet', href: '/styles.css' });
 */
export function upsertHeadLink(options = {}) {
  const {
    rel = '',
    href = '',
    as,
    crossOrigin,
    dataset = {},
    id,
    attrs = {},
    onload,
  } = options;

  if (!href || !rel) return null;
  return withSafeHeadOperation(() => {
    const selector = as
      ? `link[rel="${rel}"][href="${href}"][as="${as}"]`
      : `link[rel="${rel}"][href="${href}"]`;
    let el = /** @type {HTMLLinkElement|null} */ (
      document.head.querySelector(selector)
    );
    if (el) return el;

    el = document.createElement('link');
    el.rel = rel;
    el.href = href;
    if (as) el.as = as;
    if (crossOrigin) el.crossOrigin = crossOrigin;
    if (id) el.id = id;
    Object.entries(dataset || {}).forEach(([key, value]) => {
      if (el) el.dataset[key] = value;
    });
    Object.entries(attrs || {}).forEach(([key, value]) => {
      if (el) el.setAttribute(key, value);
    });
    if (typeof onload === 'function' && el) {
      el.onload = /** @type {(this: GlobalEventHandlers, ev: Event) => any} */ (
        onload
      );
    }
    return appendHeadNode(el);
  });
}

/**
 * Upsert a meta element in the head
 * @param {string} nameOrProperty - Meta name or property
 * @param {string} content - Meta content
 * @param {boolean} [isProperty=false] - True if property attribute
 * @returns {Element|null}
 * @example
 * upsertMeta('description', 'Page description');
 * upsertMeta('og:title', 'Page Title', true);
 */
export function upsertMeta(nameOrProperty, content, isProperty = false) {
  if (!content) return null;
  return withSafeHeadOperation(() => {
    const selector = isProperty
      ? `meta[property="${nameOrProperty}"]`
      : `meta[name="${nameOrProperty}"]`;
    let el = document.head.querySelector(selector);
    if (el) {
      el.setAttribute('content', content);
      return el;
    }
    el = document.createElement('meta');
    el.setAttribute(isProperty ? 'property' : 'name', nameOrProperty);
    el.setAttribute('content', content);
    return appendHeadNode(el);
  });
}

function appendHeadNode(el) {
  document.head.appendChild(el);
  return el;
}

function withSafeHeadOperation(fn) {
  try {
    return fn();
  } catch {
    return null;
  }
}

// Pre-compiled regex for better performance (avoid recompilation on each call)
const BRAND_REGEX =
  /\s*(?:[—–-]\s*Abdulkerim Sesli|\|\s*Abdulkerim Sesli|Abdulkerim\s*—\s*Digital Creator Portfolio)\s*$/i;

/**
 * Entfernt Branding‑Suffixe aus Titles/Headings.
 * Repräsentiert den vorher in `head-inline.js` verwendeten Branding‑Sanitizer.
 * @param {string} input
 * @returns {string}
 */
export function stripBranding(input) {
  return String(input || '')
    .replace(BRAND_REGEX, '')
    .trim();
}

// ============================================================================
// HTML SANITIZATION
// ============================================================================

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

export function sanitizeHTML(html, options = {}) {
  if (html == null) return '';
  const source = String(html);
  if (!source) return '';

  if (typeof document === 'undefined') {
    return escapeHTML(source);
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
    return escapeHTML(source);
  }
}

// ============================================================================
// TIMER MANAGER
// ============================================================================

export class TimerManager {
  constructor(name = 'TimerManager') {
    this.name = name;
    this.timers = new Set();
    this.intervals = new Set();
    this.rafIds = new Set();
  }

  _runSafely(label, fn) {
    try {
      fn();
    } catch (err) {
      log.error(`[${this.name}] ${label} error:`, err);
    }
  }

  setTimeout(fn, delay) {
    const id = setTimeout(() => {
      this.timers.delete(id);
      this._runSafely('setTimeout', fn);
    }, delay);
    this.timers.add(id);
    return id;
  }

  setInterval(fn, delay) {
    const id = setInterval(() => {
      this._runSafely('setInterval', fn);
    }, delay);
    this.intervals.add(id);
    return id;
  }

  requestAnimationFrame(fn) {
    const id = requestAnimationFrame(() => {
      this.rafIds.delete(id);
      this._runSafely('RAF', fn);
    });
    this.rafIds.add(id);
    return id;
  }

  clearTimeout(id) {
    clearTimeout(id);
    this.timers.delete(id);
  }

  clearInterval(id) {
    clearInterval(id);
    this.intervals.delete(id);
  }

  cancelAnimationFrame(id) {
    cancelAnimationFrame(id);
    this.rafIds.delete(id);
  }

  clearAll() {
    this.timers.forEach((id) => clearTimeout(id));
    this.intervals.forEach((id) => clearInterval(id));
    this.rafIds.forEach((id) => cancelAnimationFrame(id));
    this.timers.clear();
    this.intervals.clear();
    this.rafIds.clear();
  }

  get activeTimers() {
    return {
      timeouts: this.timers.size,
      intervals: this.intervals.size,
      rafs: this.rafIds.size,
      total: this.timers.size + this.intervals.size + this.rafIds.size,
    };
  }
}

// ============================================================================
// INTERSECTION OBSERVER UTILITIES
// ============================================================================

export function createObserver(callback, options = {}) {
  const observer = new IntersectionObserver(callback, options);
  return {
    observe: (el) => observer.observe(el),
    unobserve: (el) => observer.unobserve(el),
    disconnect: () => observer.disconnect(),
    raw: observer,
  };
}

export function observeOnce(target, onIntersect, options = {}) {
  if (!target) return () => {};
  const obs = new IntersectionObserver((entries, o) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        try {
          onIntersect(entry);
        } finally {
          o.disconnect();
        }
        break;
      }
    }
  }, options);

  obs.observe(target);
  return () => obs.disconnect();
}
