// @ts-check
/**
 * Head State Manager
 * Centralized state management for head component initialization
 * @version 1.0.0
 */

import { createLogger } from '/content/core/logger.js';

const log = createLogger('HeadState');

/**
 * @typedef {Object} HeadStateConfig
 * @property {boolean} inlineReady - Whether head-inline.js has completed
 * @property {boolean} managerLoaded - Whether head-manager.js has loaded
 */

/**
 * Singleton state manager for Head component system
 */
class HeadStateManager {
  constructor() {
    /** @type {HeadStateConfig} */
    this.config = {
      inlineReady: false,
      managerLoaded: false,
    };

    /** @type {Set<Function>} */
    this.readyListeners = new Set();

    /** @type {Promise<void>|null} */
    this.readyPromise = null;

    /** @type {Function|null} */
    this.readyResolve = null;
  }

  /**
   * Mark head-inline as ready
   */
  setInlineReady() {
    if (this.config.inlineReady) return;

    this.config.inlineReady = true;
    log.debug('Head inline ready');

    // Resolve waiting promises
    if (this.readyResolve) {
      this.readyResolve();
      this.readyResolve = null;
    }

    // Notify listeners
    this.notifyReadyListeners();
  }

  /**
   * Check if head-inline is ready
   * @returns {boolean}
   */
  isInlineReady() {
    return this.config.inlineReady;
  }

  /**
   * Mark head-manager as loaded
   */
  setManagerLoaded() {
    this.config.managerLoaded = true;
    log.debug('Head manager loaded');
  }

  /**
   * Check if head-manager is loaded
   * @returns {boolean}
   */
  isManagerLoaded() {
    return this.config.managerLoaded;
  }

  /**
   * Wait for head-inline to be ready
   * @param {number} [timeout=5000] - Timeout in milliseconds
   * @returns {Promise<void>}
   */
  waitForInlineReady(timeout = 5000) {
    if (this.config.inlineReady) {
      return Promise.resolve();
    }

    // Create promise if it doesn't exist
    if (!this.readyPromise) {
      this.readyPromise = new Promise((resolve) => {
        this.readyResolve = resolve;

        // Set timeout
        const timeoutId = setTimeout(() => {
          log.warn(
            `Timeout waiting for head-inline (${timeout}ms), proceeding anyway`,
          );
          this.readyResolve = null;
          this.readyPromise = null;
          resolve();
        }, timeout);

        // Clear timeout when resolved
        const originalResolve = this.readyResolve;
        this.readyResolve = () => {
          clearTimeout(timeoutId);
          this.readyPromise = null;
          originalResolve();
        };
      });
    }

    return this.readyPromise;
  }

  /**
   * Subscribe to ready state
   * @param {Function} listener - Callback when ready
   * @returns {Function} - Unsubscribe function
   */
  onReady(listener) {
    if (this.config.inlineReady) {
      // Already ready, call immediately
      try {
        listener();
      } catch (error) {
        log.warn('Ready listener failed:', error);
      }
      return () => {};
    }

    this.readyListeners.add(listener);
    return () => this.readyListeners.delete(listener);
  }

  /**
   * Notify all ready listeners
   */
  notifyReadyListeners() {
    this.readyListeners.forEach((listener) => {
      try {
        listener();
      } catch (error) {
        log.warn('Ready listener notification failed:', error);
      }
    });
    this.readyListeners.clear();
  }

  /**
   * Reset state (for testing)
   */
  reset() {
    this.config = {
      inlineReady: false,
      managerLoaded: false,
    };
    this.readyListeners.clear();
    this.readyPromise = null;
    this.readyResolve = null;
    log.debug('State reset');
  }

  /**
   * Get full config (read-only copy)
   * @returns {HeadStateConfig}
   */
  getConfig() {
    return { ...this.config };
  }
}

// Export singleton instance
export const headState = new HeadStateManager();
