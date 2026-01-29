/**
 * DOM Utility Functions
 * Common DOM helpers used across the application
 * @version 1.0.0
 */

/**
 * Safe getElementById wrapper
 * @param {string} id - Element ID
 * @returns {HTMLElement|null}
 */
export function getElementById(id) {
  return id ? document.getElementById(id) : null;
}

/**
 * Safe querySelector wrapper
 * @param {string} selector - CSS selector
 * @param {Element|Document} context - Context element
 * @returns {Element|null}
 */
export function querySelector(selector, context = document) {
  try {
    return context?.querySelector(selector) || null;
  } catch {
    return null;
  }
}

/**
 * Safe querySelectorAll wrapper
 * @param {string} selector - CSS selector
 * @param {Element|Document} context - Context element
 * @returns {Element[]}
 */
export function querySelectorAll(selector, context = document) {
  try {
    return Array.from(context?.querySelectorAll(selector) || []);
  } catch {
    return [];
  }
}

/**
 * Check if element exists in DOM
 * @param {string} selector - CSS selector
 * @param {Element|Document} context - Context element
 * @returns {boolean}
 */
export function exists(selector, context = document) {
  return !!querySelector(selector, context);
}

/**
 * Wait for element to appear in DOM
 * @param {string} selector - CSS selector
 * @param {number} timeout - Timeout in ms
 * @returns {Promise<Element>}
 */
export function waitForElement(selector, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const element = querySelector(selector);
    if (element) {
      resolve(element);
      return;
    }

    const observer = new MutationObserver(() => {
      const element = querySelector(selector);
      if (element) {
        observer.disconnect();
        resolve(element);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Element ${selector} not found within ${timeout}ms`));
    }, timeout);
  });
}

/**
 * Debounce a function
 * @param {Function} fn - Function to debounce
 * @param {number} delay - Delay in ms
 * @returns {Function} Debounced function
 */
export const debounce = (fn, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
};

/**
 * Throttle a function
 * @param {Function} func - Function to throttle
 * @param {number} limit - Limit in ms
 * @returns {Function} Throttled function
 */
export const throttle = (func, limit = 250) => {
  let inThrottle = false;
  return (...args) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};

/**
 * Execute callback when DOM is ready
 * @param {Function} callback - Function to execute
 * @param {Object} options - Options for addEventListener
 */
export function onDOMReady(callback, options = { once: true }) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', callback, options);
  } else {
    callback();
  }
}

/**
 * DOM Element Cache
 * Cache frequently accessed DOM elements
 */
const domCache = new Map();

/**
 * Get cached element or query and cache it
 * @param {string} selector - CSS selector
 * @param {boolean} forceRefresh - Force refresh cache
 * @returns {Element|null}
 */
export function getCachedElement(selector, forceRefresh = false) {
  if (!forceRefresh && domCache.has(selector)) {
    const el = domCache.get(selector);
    // Check if element is still in DOM
    if (el?.isConnected) return el;
    // Remove stale cache entry
    domCache.delete(selector);
  }

  const el = querySelector(selector);
  if (el) domCache.set(selector, el);
  return el;
}

/**
 * Clear DOM cache
 * @param {string} selector - Optional selector to clear specific entry
 */
export function clearDOMCache(selector = null) {
  if (selector) {
    domCache.delete(selector);
  } else {
    domCache.clear();
  }
}

/**
 * Get cache statistics
 * @returns {Object} Cache stats
 */
export function getDOMCacheStats() {
  const stats = {
    size: domCache.size,
    connected: 0,
    disconnected: 0,
  };

  domCache.forEach((el) => {
    if (el?.isConnected) {
      stats.connected++;
    } else {
      stats.disconnected++;
    }
  });

  return stats;
}

/**
 * Clean up disconnected elements from cache
 */
export function cleanupDOMCache() {
  const toDelete = [];
  domCache.forEach((el, selector) => {
    if (!el?.isConnected) {
      toDelete.push(selector);
    }
  });
  toDelete.forEach((selector) => domCache.delete(selector));
  return toDelete.length;
}

/**
 * Upsert a link element in the head
 * @param {Object} options - Link attributes
 * @returns {Element|null}
 */
export function upsertHeadLink({
  rel,
  href,
  as,
  crossOrigin,
  dataset = {},
  id,
  attrs = {},
  onload,
} = {}) {
  if (!href || !rel) return null;
  try {
    const selector = as
      ? `link[rel="${rel}"][href="${href}"][as="${as}"]`
      : `link[rel="${rel}"][href="${href}"]`;
    let el = document.head.querySelector(selector);
    if (el) return el;

    el = document.createElement('link');
    el.rel = rel;
    el.href = href;
    if (as) el.as = as;
    if (crossOrigin) el.crossOrigin = crossOrigin;
    if (id) el.id = id;
    Object.entries(dataset || {}).forEach(([key, value]) => {
      el.dataset[key] = value;
    });
    Object.entries(attrs || {}).forEach(([key, value]) =>
      el.setAttribute(key, value),
    );
    if (typeof onload === 'function') el.onload = onload;
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
 * @param {boolean} isProperty - True if property attribute
 * @returns {Element|null}
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
 * @param {Document} doc - Document object
 * @param {Array} alternates - Alternate links
 * @param {string} effectiveCanonical - Canonical URL
 */
export function applyCanonicalLinks(
  doc = typeof document === 'undefined' ? null : document,
  alternates = [],
  effectiveCanonical = '',
) {
  if (!doc?.head) return;

  // Upsert canonical
  const canonicalEl = doc.head.querySelector('link[rel="canonical"]');
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
    let el = doc.head.querySelector(selector);
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
