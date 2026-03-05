/**
 * Cache Utilities (memory only, no local persistence)
 * @version 2.0.0
 */

import { CACHE_DURATION } from '../config/constants.js';

// In-memory cache for faster access
const memoryCache = new Map();
const MAX_MEMORY_CACHE = 50;

/**
 * Get cached data (memory only)
 * @param {string} key - Cache key
 * @returns {any | null}
 */
export const getCache = (key) => {
  // Try memory cache first
  const memItem = memoryCache.get(key);
  if (memItem) {
    if (Date.now() - memItem.timestamp <= CACHE_DURATION) {
      return memItem.data;
    }
    memoryCache.delete(key);
  }

  return null;
};

/**
 * Set cached data (memory only)
 * @param {string} key - Cache key
 * @param {any} data - Data to cache
 */
export const setCache = (key, data) => {
  const timestamp = Date.now();

  setMemoryCache(key, data, timestamp);
};

/**
 * Set memory cache with LRU eviction
 * @private
 */
function setMemoryCache(key, data, timestamp) {
  // Evict oldest if full
  if (memoryCache.size >= MAX_MEMORY_CACHE && !memoryCache.has(key)) {
    const firstKey = memoryCache.keys().next().value;
    memoryCache.delete(firstKey);
  }

  memoryCache.set(key, { data, timestamp });
}
