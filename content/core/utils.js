/**
 * Core Utilities
 * Central collection of utility functions for DOM, Async and general helpers
 * @version 2.0.0
 * @date 2026-01-30
 */

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
        if (!leading || timeSinceLastCall <= delay) {
          execute();
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

      setTimeout(() => {
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
 * onDOMReady(() => console.log('DOM ready!'));
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

/**
 * Apply canonical links and alternates
 * @param {Document} [doc=document] - Document object
 * @param {Array} [alternates=[]] - Alternate links array
 * @param {string} [effectiveCanonical=''] - Canonical URL
 * @example
 * applyCanonicalLinks(document, [
 *   { lang: 'en', href: 'https://example.com/en' },
 *   { lang: 'de', href: 'https://example.com/de' }
 * ], 'https://example.com');
 */
export function applyCanonicalLinks(
  doc = typeof document === 'undefined' ? null : document,
  alternates = [],
  effectiveCanonical = '',
) {
  if (!doc?.head) return;

  // Upsert canonical
  const canonicalEl = /** @type {HTMLLinkElement|null} */ (
    doc.head.querySelector('link[rel="canonical"]')
  );
  if (canonicalEl) {
    if (typeof canonicalEl.setAttribute === 'function')
      canonicalEl.setAttribute('href', effectiveCanonical);
    else canonicalEl.href = effectiveCanonical;
  } else {
    const el = doc.createElement('link');
    el.setAttribute('rel', 'canonical');
    el.setAttribute('href', effectiveCanonical);
    doc.head.appendChild(el);
  }

  // Upsert alternates
  alternates.forEach(({ lang, href }) => {
    if (!href) return;
    const selector = `link[rel="alternate"][hreflang="${lang}"]`;
    let el = /** @type {HTMLLinkElement|null} */ (
      doc.head.querySelector(selector)
    );
    if (el) {
      if (typeof el.setAttribute === 'function') el.setAttribute('href', href);
      else el.href = href;
    } else {
      el = doc.createElement('link');
      el.setAttribute('rel', 'alternate');
      el.setAttribute('hreflang', lang);
      el.setAttribute('href', href);
      doc.head.appendChild(el);
    }
  });
}
