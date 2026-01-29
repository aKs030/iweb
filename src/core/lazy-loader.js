/**
 * Lazy Loader
 * Intelligent lazy loading for components and modules
 * @author Abdulkerim Sesli
 * @version 1.0.0
 */

import { createLogger } from './logger.js';
import { TimerManager } from './timer-utils.js';

const log = createLogger('LazyLoader');

/**
 * Lazy Loader Class
 */
export class LazyLoader {
  constructor(options = {}) {
    this.options = {
      rootMargin: '50px',
      threshold: 0.01,
      timeout: 10000,
      retries: 3,
      ...options,
    };

    this.timers = new TimerManager('LazyLoader');
    this.observers = new Map();
    this.loaded = new Set();
    this.loading = new Set();
  }

  /**
   * Lazy load a module when element is visible
   * @param {string} selector - Element selector
   * @param {Function} loader - Module loader function
   * @param {Object} options - Options
   * @returns {Promise}
   */
  async loadOnVisible(selector, loader, options = {}) {
    const element = document.querySelector(selector);

    if (!element) {
      log.warn(`Element not found: ${selector}`);
      return null;
    }

    // Already loaded
    if (this.loaded.has(selector)) {
      log.debug(`Already loaded: ${selector}`);
      return null;
    }

    // Currently loading
    if (this.loading.has(selector)) {
      log.debug(`Already loading: ${selector}`);
      return null;
    }

    return new Promise((resolve, reject) => {
      const observer = new IntersectionObserver(
        async (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              observer.disconnect();
              this.observers.delete(selector);

              try {
                this.loading.add(selector);
                log.info(`Loading: ${selector}`);

                const result = await this.loadWithRetry(loader, options);

                this.loaded.add(selector);
                this.loading.delete(selector);

                log.info(`Loaded: ${selector}`);
                resolve(result);
              } catch (err) {
                this.loading.delete(selector);
                log.error(`Failed to load ${selector}:`, err);
                reject(err);
              }
            }
          }
        },
        {
          rootMargin: options.rootMargin || this.options.rootMargin,
          threshold: options.threshold || this.options.threshold,
        },
      );

      observer.observe(element);
      this.observers.set(selector, observer);

      // Timeout fallback
      this.timers.setTimeout(() => {
        if (!this.loaded.has(selector) && !this.loading.has(selector)) {
          log.warn(`Timeout loading ${selector}, forcing load`);
          observer.disconnect();
          this.loadWithRetry(loader, options).then(resolve).catch(reject);
        }
      }, options.timeout || this.options.timeout);
    });
  }

  /**
   * Load module with retry logic
   * @param {Function} loader - Loader function
   * @param {Object} options - Options
   * @returns {Promise}
   */
  async loadWithRetry(loader, options = {}) {
    const retries = options.retries || this.options.retries;
    let lastError;

    for (let i = 0; i < retries; i++) {
      try {
        return await loader();
      } catch (err) {
        lastError = err;
        log.warn(`Load attempt ${i + 1} failed:`, err);

        if (i < retries - 1) {
          await this.timers.sleep(Math.pow(2, i) * 1000);
        }
      }
    }

    throw lastError;
  }

  /**
   * Lazy load on user interaction
   * @param {string} selector - Element selector
   * @param {Function} loader - Module loader function
   * @param {Object} options - Options
   * @returns {Promise}
   */
  loadOnInteraction(selector, loader, options = {}) {
    const element = document.querySelector(selector);

    if (!element) {
      log.warn(`Element not found: ${selector}`);
      return Promise.resolve(null);
    }

    if (this.loaded.has(selector)) {
      return Promise.resolve(null);
    }

    const events = options.events || ['click', 'touchstart', 'mouseenter'];

    return new Promise((resolve, reject) => {
      const handler = async () => {
        // Remove all listeners
        events.forEach((event) => {
          element.removeEventListener(event, handler);
        });

        try {
          this.loading.add(selector);
          const result = await this.loadWithRetry(loader, options);
          this.loaded.add(selector);
          this.loading.delete(selector);
          resolve(result);
        } catch (err) {
          this.loading.delete(selector);
          reject(err);
        }
      };

      // Attach listeners
      events.forEach((event) => {
        element.addEventListener(event, handler, { once: true, passive: true });
      });
    });
  }

  /**
   * Lazy load on idle
   * @param {Function} loader - Module loader function
   * @param {Object} options - Options
   * @returns {Promise}
   */
  loadOnIdle(loader, options = {}) {
    return new Promise((resolve, reject) => {
      const callback = async () => {
        try {
          const result = await this.loadWithRetry(loader, options);
          resolve(result);
        } catch (err) {
          reject(err);
        }
      };

      if ('requestIdleCallback' in window) {
        requestIdleCallback(callback, {
          timeout: options.timeout || 2000,
        });
      } else {
        this.timers.setTimeout(callback, 1000);
      }
    });
  }

  /**
   * Prefetch module for future use
   * @param {Function} loader - Module loader function
   * @returns {Promise}
   */
  async prefetch(loader) {
    try {
      log.info('Prefetching module');
      return await loader();
    } catch (err) {
      log.error('Prefetch failed:', err);
      return null;
    }
  }

  /**
   * Check if module is loaded
   * @param {string} selector - Selector
   * @returns {boolean}
   */
  isLoaded(selector) {
    return this.loaded.has(selector);
  }

  /**
   * Check if module is loading
   * @param {string} selector - Selector
   * @returns {boolean}
   */
  isLoading(selector) {
    return this.loading.has(selector);
  }

  /**
   * Get loading stats
   * @returns {Object}
   */
  getStats() {
    return {
      loaded: this.loaded.size,
      loading: this.loading.size,
      observers: this.observers.size,
      loadedModules: Array.from(this.loaded),
    };
  }

  /**
   * Cleanup
   */
  cleanup() {
    this.observers.forEach((observer) => observer.disconnect());
    this.observers.clear();
    this.timers.clearAll();
    log.info('Lazy loader cleaned up');
  }
}

// Singleton instance
let instance = null;

/**
 * Get LazyLoader instance
 * @returns {LazyLoader}
 */
export function getLazyLoader() {
  if (!instance) {
    instance = new LazyLoader();
  }
  return instance;
}

/**
 * Quick helper functions
 */
export const lazyLoad = {
  onVisible: (selector, loader, options) =>
    getLazyLoader().loadOnVisible(selector, loader, options),

  onInteraction: (selector, loader, options) =>
    getLazyLoader().loadOnInteraction(selector, loader, options),

  onIdle: (loader, options) => getLazyLoader().loadOnIdle(loader, options),

  prefetch: (loader) => getLazyLoader().prefetch(loader),

  isLoaded: (selector) => getLazyLoader().isLoaded(selector),

  getStats: () => getLazyLoader().getStats(),
};
