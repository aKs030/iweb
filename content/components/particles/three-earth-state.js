// @ts-check
/**
 * Three.js Earth State Manager
 * Centralized state management to replace globalThis usage
 * @version 1.0.0
 */

import { createLogger } from '/content/core/logger.js';

const log = createLogger('ThreeEarthState');

/**
 * @typedef {Object} ThreeEarthConfig
 * @property {Object.<string, any>} [cameraPresets] - Custom camera presets
 * @property {boolean} [forceEnable] - Force enable Three.js even in test environments
 * @property {Function|null} [cleanupFn] - Cleanup function reference
 */

/**
 * Singleton state manager for Three.js Earth system
 */
class ThreeEarthStateManager {
  constructor() {
    /** @type {ThreeEarthConfig} */
    this.config = {
      cameraPresets: {},
      forceEnable: false,
      cleanupFn: null,
    };

    /** @type {Set<Function>} */
    this.stateChangeListeners = new Set();
  }

  /**
   * Set custom camera presets
   * @param {Object.<string, any>} presets
   */
  setCameraPresets(presets) {
    if (!presets || typeof presets !== 'object') {
      log.warn('Invalid camera presets provided');
      return;
    }
    this.config.cameraPresets = { ...this.config.cameraPresets, ...presets };
    this.notifyListeners('cameraPresets');
    log.debug('Camera presets updated', Object.keys(presets));
  }

  /**
   * Get camera presets
   * @returns {Object.<string, any>}
   */
  getCameraPresets() {
    return { ...this.config.cameraPresets };
  }

  /**
   * Force enable Three.js (useful for testing)
   * @param {boolean} enable
   */
  setForceEnable(enable) {
    this.config.forceEnable = Boolean(enable);
    this.notifyListeners('forceEnable');
    log.debug('Force enable set to:', this.config.forceEnable);
  }

  /**
   * Check if Three.js is force-enabled
   * @returns {boolean}
   */
  isForceEnabled() {
    return this.config.forceEnable;
  }

  /**
   * Set cleanup function
   * @param {Function|null} fn
   */
  setCleanupFunction(fn) {
    if (fn && typeof fn !== 'function') {
      log.warn('Invalid cleanup function provided');
      return;
    }
    this.config.cleanupFn = fn;
    this.notifyListeners('cleanupFn');
  }

  /**
   * Get cleanup function
   * @returns {Function|null}
   */
  getCleanupFunction() {
    return this.config.cleanupFn;
  }

  /**
   * Execute cleanup if available
   * @returns {boolean} - Whether cleanup was executed
   */
  executeCleanup() {
    if (this.config.cleanupFn) {
      try {
        this.config.cleanupFn();
        this.config.cleanupFn = null;
        log.info('Cleanup executed successfully');
        return true;
      } catch (error) {
        log.warn('Cleanup execution failed:', error);
        return false;
      }
    }
    return false;
  }

  /**
   * Subscribe to state changes
   * @param {Function} listener
   * @returns {Function} - Unsubscribe function
   */
  subscribe(listener) {
    this.stateChangeListeners.add(listener);
    return () => this.stateChangeListeners.delete(listener);
  }

  /**
   * Notify all listeners of state change
   * @param {string} key - The config key that changed
   */
  notifyListeners(key) {
    this.stateChangeListeners.forEach((listener) => {
      try {
        listener(key, this.config);
      } catch (error) {
        log.warn('Listener notification failed:', error);
      }
    });
  }

  /**
   * Reset all state to defaults
   */
  reset() {
    this.config = {
      cameraPresets: {},
      forceEnable: false,
      cleanupFn: null,
    };
    this.notifyListeners('reset');
    log.debug('State reset to defaults');
  }

  /**
   * Get full config (read-only copy)
   * @returns {ThreeEarthConfig}
   */
  getConfig() {
    return {
      cameraPresets: { ...this.config.cameraPresets },
      forceEnable: this.config.forceEnable,
      cleanupFn: this.config.cleanupFn,
    };
  }
}

// Export singleton instance
export const threeEarthState = new ThreeEarthStateManager();
