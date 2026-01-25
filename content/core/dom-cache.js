/**
 * DOM Cache Utility
 * Provides cached access to DOM elements
 * @version 1.0.0
 */

import { getElementById } from './shared-utilities.js';

class DOMCache {
  constructor() {
    this.cache = new Map();
  }

  /**
   * Get element from cache or DOM
   * @param {string} id - Element ID
   * @param {*} fallback - Fallback value if element not found
   * @returns {HTMLElement|null}
   */
  get(id, fallback = null) {
    if (!id) return fallback;

    const cacheKey = id.replace(/[^a-zA-Z]/g, '');

    if (!this.cache.has(cacheKey)) {
      const element = getElementById(id) || fallback;
      this.cache.set(cacheKey, element);
    }

    return this.cache.get(cacheKey);
  }

  /**
   * Clear all cached elements
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Remove specific element from cache
   * @param {string} id - Element ID
   */
  delete(id) {
    const cacheKey = id.replace(/[^a-zA-Z]/g, '');
    this.cache.delete(cacheKey);
  }

  /**
   * Check if element is cached
   * @param {string} id - Element ID
   * @returns {boolean}
   */
  has(id) {
    const cacheKey = id.replace(/[^a-zA-Z]/g, '');
    return this.cache.has(cacheKey);
  }
}

// Singleton instance
export const domCache = new DOMCache();

// Helper functions for common elements
export function getThreeEarthContainer() {
  return domCache.get('threeEarthContainer') || domCache.get('earth-container');
}

export function getSnapContainer() {
  return domCache.get('snap-container', document.documentElement);
}
