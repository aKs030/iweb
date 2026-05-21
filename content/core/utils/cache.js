/**
 * Small in-memory cache with TTL and LRU eviction.
 * @version 1.0.0
 */

import { createLogger } from "../logger.js";

const log = createLogger("Cache");

/**
 * @typedef {Object} CacheOptions
 * @property {number} [memorySize=50] - Maximum number of cached items
 */

/**
 * @typedef {Object} CacheSetOptions
 * @property {number} [ttl=300000] - Time-to-live in milliseconds (5 min default)
 */

/**
 * In-memory cache manager with TTL support and LRU eviction policy
 */
class CacheManager {
  /**
   * Create a new cache manager
   * @param {CacheOptions} [options] - Cache configuration
   */
  constructor(options = {}) {
    this.items = new Map();
    // Default: 50 items for DOM cache, configurable for other use cases
    this.maxSize = options.memorySize ?? 50;
  }

  /**
   * Retrieve a value from the cache
   * @param {string} key - Cache key
   * @returns {*|null} Cached value or null if expired/missing
   */
  get(key) {
    const item = this.items.get(key);

    if (!item) {
      log.debug(`Cache miss: ${key}`);
      return null;
    }

    if (item.expires && item.expires < Date.now()) {
      this.items.delete(key);
      log.debug(`Cache expired: ${key}`);
      return null;
    }

    this.items.delete(key);
    this.items.set(key, item);
    log.debug(`Cache hit: ${key}`);
    return item.value;
  }

  /**
   * Store a value in the cache with optional TTL
   * @param {string} key - Cache key
   * @param {*} value - Value to cache
   * @param {CacheSetOptions} [options] - Cache options
   */
  set(key, value, options = {}) {
    const ttl = options.ttl ?? 300000;

    if (this.items.has(key)) {
      this.items.delete(key);
    } else if (this.items.size >= this.maxSize) {
      const oldestKey = this.items.keys().next().value;
      this.items.delete(oldestKey);
    }

    this.items.set(key, {
      value,
      expires: ttl ? Date.now() + ttl : null,
    });
  }

  /**
   * Remove a value from the cache
   * @param {string} key - Cache key
   * @returns {boolean} True if key existed
   */
  delete(key) {
    return this.items.delete(key);
  }
}

let globalCache = null;

/**
 * Get or create a global singleton cache instance
 * @param {CacheOptions} [options] - Cache configuration
 * @returns {CacheManager} Global cache instance
 */
export function getCache(options) {
  if (!globalCache) {
    globalCache = new CacheManager(options);
  }
  return globalCache;
}
