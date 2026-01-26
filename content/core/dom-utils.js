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
