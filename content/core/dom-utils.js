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
export function debounce(fn, delay) {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      fn.apply(this, args);
    }, delay);
  };
}

/**
 * Throttle a function
 * @param {Function} func - Function to throttle
 * @param {number} limit - Limit in ms
 * @returns {Function} Throttled function
 */
export function throttle(func, limit = 250) {
  let inThrottle = false;
  return function (...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

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
