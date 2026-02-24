/**
 * Core Utilities
 * Central collection of utility functions for DOM, Async and general helpers
 * @version 2.0.0
 * @date 2026-01-30
 */

import React from 'react';
import DOMPurify from 'dompurify';
import { createLogger } from './logger.js';

const log = createLogger('Utils');

// ============================================================================
// ASYNC UTILITIES
// ============================================================================

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
  try {
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
    document.head.appendChild(el);
    return el;
  } catch {
    return null;
  }
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
  try {
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
    document.head.appendChild(el);
    return el;
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

export function sanitizeHTML(html, options = {}) {
  if (html == null) return '';
  try {
    return DOMPurify.sanitize(String(html), options);
  } catch {
    return escapeHTML(String(html));
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

  setTimeout(fn, delay) {
    const id = setTimeout(() => {
      this.timers.delete(id);
      try {
        fn();
      } catch (err) {
        log.error(`[${this.name}] setTimeout error:`, err);
      }
    }, delay);
    this.timers.add(id);
    return id;
  }

  setInterval(fn, delay) {
    const id = setInterval(() => {
      try {
        fn();
      } catch (err) {
        log.error(`[${this.name}] setInterval error:`, err);
      }
    }, delay);
    this.intervals.add(id);
    return id;
  }

  requestAnimationFrame(fn) {
    const id = requestAnimationFrame(() => {
      this.rafIds.delete(id);
      try {
        fn();
      } catch (err) {
        log.error(`[${this.name}] RAF error:`, err);
      }
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

// ============================================================================
// REACT UTILITIES
// ============================================================================

import { i18n } from './i18n.js';

export const createUseTranslation = () => {
  return () => {
    const [lang, setLang] = React.useState(i18n.currentLang);

    React.useEffect(() => {
      const onLangChange = (e) => setLang(e.detail.lang);
      i18n.addEventListener('language-changed', onLangChange);
      return () => i18n.removeEventListener('language-changed', onLangChange);
    }, []);

    const t = React.useCallback((key, params) => i18n.t(key, params), [lang]);

    return React.useMemo(() => ({ t, lang }), [t, lang]);
  };
};
