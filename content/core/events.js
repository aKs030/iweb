/**
 * Modern Event System with Type Safety
 * @version 3.0.0
 */

import { createLogger } from './logger.js';

const log = createLogger('Events');

/**
 * Event names (frozen for immutability)
 */
export const EVENTS = Object.freeze({
  // App lifecycle
  DOM_READY: 'app:domReady',
  CORE_INITIALIZED: 'app:coreInitialized',
  MODULES_READY: 'app:modulesReady',
  APP_READY: 'app:ready',
  LOADING_UNBLOCKED: 'app:loadingUnblocked',
  LOADING_HIDE: 'app:loaderHide',

  // Hero
  HERO_INIT_READY: 'app:heroInitReady',
  HERO_LOADED: 'hero:loaded',
  HERO_TYPING_END: 'hero:typingEnd',

  // Features
  FEATURES_TEMPLATES_LOADED: 'featuresTemplatesLoaded',
  FEATURES_TEMPLATES_ERROR: 'featuresTemplatesError',
  TEMPLATE_MOUNTED: 'template:mounted',
  FEATURES_CHANGE: 'features:change',

  // Service Worker
  SW_UPDATE_AVAILABLE: 'sw:updateAvailable',
  SW_INSTALLED: 'sw:installed',
  SW_ACTIVATED: 'sw:activated',

  // Sections
  SECTION_LOADED: 'section:loaded',
  SECTION_CHANGE: 'section:change',

  // Footer
  FOOTER_LOADED: 'footer:loaded',
  FOOTER_EXPANDED: 'footer:expanded',
  FOOTER_COLLAPSED: 'footer:collapsed',
});

/**
 * Event emitter class
 */
class EventEmitter {
  constructor() {
    this.listeners = new Map();
  }

  /**
   * Add event listener
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   * @param {Object} [options] - Options
   * @returns {Function} Unsubscribe function
   */
  on(event, callback, options = {}) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }

    const listener = { callback, options };
    this.listeners.get(event).add(listener);

    return () => this.off(event, callback);
  }

  /**
   * Add one-time event listener
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  once(event, callback) {
    return this.on(event, callback, { once: true });
  }

  /**
   * Remove event listener
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   */
  off(event, callback) {
    const listeners = this.listeners.get(event);
    if (!listeners) return;

    for (const listener of listeners) {
      if (listener.callback === callback) {
        listeners.delete(listener);
        break;
      }
    }

    if (listeners.size === 0) {
      this.listeners.delete(event);
    }
  }

  /**
   * Emit event
   * @param {string} event - Event name
   * @param {*} [detail] - Event detail
   */
  emit(event, detail) {
    const listeners = this.listeners.get(event);
    if (!listeners) return;

    for (const listener of [...listeners]) {
      try {
        listener.callback(detail);

        if (listener.options.once) {
          listeners.delete(listener);
        }
      } catch (error) {
        log.error(`Error in event listener for ${event}:`, error);
      }
    }
  }

  /**
   * Remove all listeners
   * @param {string} [event] - Event name (optional)
   */
  clear(event) {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }

  /**
   * Get listener count
   * @param {string} [event] - Event name (optional)
   * @returns {number}
   */
  listenerCount(event) {
    if (event) {
      return this.listeners.get(event)?.size || 0;
    }
    return Array.from(this.listeners.values()).reduce(
      (sum, set) => sum + set.size,
      0,
    );
  }
}

// Global event emitter
const emitter = new EventEmitter();

/**
 * Fire custom event on document
 * @param {string} type - Event type
 * @param {*} [detail] - Event detail
 * @param {EventTarget} [target] - Event target
 */
export function fire(type, detail = null, target = document) {
  if (!target?.dispatchEvent) return;

  try {
    target.dispatchEvent(new CustomEvent(type, { detail, bubbles: true }));
    emitter.emit(type, detail);
  } catch (error) {
    log.error(`Failed to dispatch event: ${type}`, error);
  }
}

/**
 * Listen to event (currently unused - kept for API completeness)
 * @param {string} event - Event name
 * @param {Function} callback - Callback function
 * @param {Object} [options] - Options
 * @returns {Function} Unsubscribe function
 */
const _on = (event, callback, options) => {
  return emitter.on(event, callback, options);
};

/**
 * Listen to event once (currently unused - kept for API completeness)
 * @param {string} event - Event name
 * @param {Function} callback - Callback function
 * @returns {Function} Unsubscribe function
 */
const _once = (event, callback) => {
  return emitter.once(event, callback);
};

/**
 * Remove event listener (currently unused - kept for API completeness)
 * @param {string} event - Event name
 * @param {Function} callback - Callback function
 */
const _off = (event, callback) => {
  emitter.off(event, callback);
};

// Exports removed - not used anywhere in codebase
// Kept as internal functions for potential future use
// export { _on as on, _once as once, _off as off, EventEmitter };
