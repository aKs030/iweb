/**
 * Cache Utilities with Memory + LocalStorage
 * @version 2.0.0
 */

import { CACHE_PREFIX, CACHE_DURATION } from '../config/constants.js';

// In-memory cache for faster access
const memoryCache = new Map();
const MAX_MEMORY_CACHE = 50;

/**
 * Get cached data (memory first, then localStorage)
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

  // Fallback to localStorage
  try {
    const item = localStorage.getItem(CACHE_PREFIX + key);
    if (!item) return null;

    const { data, timestamp } = JSON.parse(item);
    if (Date.now() - timestamp > CACHE_DURATION) {
      localStorage.removeItem(CACHE_PREFIX + key);
      return null;
    }

    // Populate memory cache
    setMemoryCache(key, data, timestamp);
    return data;
  } catch {
    return null;
  }
};

/**
 * Set cached data (both memory and localStorage)
 * @param {string} key - Cache key
 * @param {any} data - Data to cache
 */
export const setCache = (key, data) => {
  const timestamp = Date.now();

  // Set in memory cache
  setMemoryCache(key, data, timestamp);

  // Set in localStorage
  try {
    localStorage.setItem(
      CACHE_PREFIX + key,
      JSON.stringify({ data, timestamp }),
    );
  } catch (e) {
    console.warn('Cache write failed:', e);
  }
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

/**
 * Clear all caches
 */
export const clearCache = () => {
  memoryCache.clear();
  try {
    const keys = Object.keys(localStorage);
    keys.forEach((key) => {
      if (key.startsWith(CACHE_PREFIX)) {
        localStorage.removeItem(key);
      }
    });
  } catch (e) {
    console.warn('Cache clear failed:', e);
  }
};
