/**
 * DOM Utilities - Centralized DOM manipulation helpers
 * @version 1.0.0
 */

// ============================================================================
// DOM QUERY & READY STATE
// ============================================================================

/**
 * Safe getElementById wrapper
 * @param {string} id - Element ID
 * @returns {HTMLElement|null}
 */
export function getElementById(id) {
  return id ? document.getElementById(id) : null;
}

/**
 * Execute callback when DOM is ready
 * @param {Function} callback - Function to execute
 * @param {Object} [options={ once: true }] - Options for addEventListener
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

// ============================================================================
// INTERSECTION OBSERVER UTILITIES
// ============================================================================

/**
 * Create an intersection observer wrapper
 * @param {IntersectionObserverCallback} callback - Observer callback
 * @param {IntersectionObserverInit} [options] - Observer options
 * @returns {Object} Observer wrapper with helper methods
 */
export function createObserver(callback, options = {}) {
  const observer = new IntersectionObserver(callback, options);
  return {
    observe: (el) => observer.observe(el),
    unobserve: (el) => observer.unobserve(el),
    disconnect: () => observer.disconnect(),
    raw: observer,
  };
}

/**
 * Observe element once and disconnect
 * @param {Element} target - Element to observe
 * @param {Function} onIntersect - Callback when intersecting
 * @param {IntersectionObserverInit} [options] - Observer options
 * @returns {Function} Cleanup function
 */
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
