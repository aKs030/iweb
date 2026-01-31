/**
 * Modern Cache Manager with IndexedDB & Memory Cache
 * @version 1.0.0
 */

import { createLogger } from './logger.js';

const log = createLogger('Cache');

/**
 * Memory cache for fast access
 */
class MemoryCache {
  constructor(maxSize = 100) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;

    if (item.expires && item.expires < Date.now()) {
      this.cache.delete(key);
      return null;
    }

    return item.value;
  }

  set(key, value, ttl = 300000) {
    // LRU eviction if cache is full
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, {
      value,
      expires: ttl ? Date.now() + ttl : null,
    });
  }

  delete(key) {
    return this.cache.delete(key);
  }

  clear() {
    this.cache.clear();
  }

  get size() {
    return this.cache.size;
  }
}

/**
 * IndexedDB cache for persistent storage
 */
class IndexedDBCache {
  constructor(dbName = 'app-cache', version = 1) {
    this.dbName = dbName;
    this.version = version;
    this.db = null;
  }

  async init() {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = globalThis.indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('cache')) {
          db.createObjectStore('cache', { keyPath: 'key' });
        }
      };
    });
  }

  async get(key) {
    try {
      await this.init();
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction(['cache'], 'readonly');
        const store = transaction.objectStore('cache');
        const request = store.get(key);

        request.onsuccess = () => {
          const item = request.result;
          if (!item) {
            resolve(null);
            return;
          }

          if (item.expires && item.expires < Date.now()) {
            this.delete(key);
            resolve(null);
            return;
          }

          resolve(item.value);
        };

        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      log.warn('IndexedDB get failed:', error);
      return null;
    }
  }

  async set(key, value, ttl = 3600000) {
    try {
      await this.init();
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction(['cache'], 'readwrite');
        const store = transaction.objectStore('cache');
        const request = store.put({
          key,
          value,
          expires: ttl ? Date.now() + ttl : null,
          created: Date.now(),
        });

        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      log.warn('IndexedDB set failed:', error);
      return false;
    }
  }

  async delete(key) {
    try {
      await this.init();
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction(['cache'], 'readwrite');
        const store = transaction.objectStore('cache');
        const request = store.delete(key);

        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      log.warn('IndexedDB delete failed:', error);
      return false;
    }
  }

  async clear() {
    try {
      await this.init();
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction(['cache'], 'readwrite');
        const store = transaction.objectStore('cache');
        const request = store.clear();

        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      log.warn('IndexedDB clear failed:', error);
      return false;
    }
  }
}

/**
 * Unified cache manager with memory + IndexedDB
 */
class CacheManager {
  constructor(options = {}) {
    this.memory = new MemoryCache(options.memorySize || 100);
    this.idb = new IndexedDBCache(options.dbName, options.dbVersion);
    this.useIndexedDB = options.useIndexedDB ?? true;
  }

  async get(key) {
    // Try memory cache first
    const memoryValue = this.memory.get(key);
    if (memoryValue !== null) {
      log.debug(`Cache hit (memory): ${key}`);
      return memoryValue;
    }

    // Try IndexedDB
    if (this.useIndexedDB) {
      const idbValue = await this.idb.get(key);
      if (idbValue !== null) {
        log.debug(`Cache hit (IndexedDB): ${key}`);
        // Populate memory cache
        this.memory.set(key, idbValue);
        return idbValue;
      }
    }

    log.debug(`Cache miss: ${key}`);
    return null;
  }

  async set(key, value, options = {}) {
    const { ttl = 300000, persistent = false } = options;

    // Always set in memory
    this.memory.set(key, value, ttl);

    // Set in IndexedDB if persistent
    if (persistent && this.useIndexedDB) {
      await this.idb.set(key, value, ttl);
    }

    log.debug(`Cache set: ${key}`);
  }

  async delete(key) {
    this.memory.delete(key);
    if (this.useIndexedDB) {
      await this.idb.delete(key);
    }
    log.debug(`Cache deleted: ${key}`);
  }

  async clear() {
    this.memory.clear();
    if (this.useIndexedDB) {
      await this.idb.clear();
    }
    log.info('Cache cleared');
  }

  getStats() {
    return {
      memorySize: this.memory.size,
      memoryMaxSize: this.memory.maxSize,
    };
  }
}

// Global cache instance
let globalCache = null;

/**
 * Get or create global cache instance
 * @param {Object} [options] - Cache options
 * @returns {CacheManager}
 */
export function getCache(options) {
  if (!globalCache) {
    globalCache = new CacheManager(options);
  }
  return globalCache;
}

/**
 * Cache decorator for functions (currently unused - kept for future use)
 * @param {Function} fn - Function to cache
 * @param {Object} [options] - Cache options
 * @returns {Function} Cached function
 */
const _cached = (fn, options = {}) => {
  const cache = getCache();
  const { ttl = 300000, keyFn = (...args) => JSON.stringify(args) } = options;

  return async (...args) => {
    const key = `fn:${fn.name}:${keyFn(...args)}`;
    const cachedValue = await cache.get(key);

    if (cachedValue !== null) {
      return cachedValue;
    }

    const result = await fn(...args);
    await cache.set(key, result, { ttl });
    return result;
  };
};

// Export removed - not used anywhere in codebase
// export { _cached as cached };

// Export for compatibility - removed unused exports:
// - cached (decorator function - not used)
// - CacheManager, MemoryCache, IndexedDBCache (internal classes - not exported directly)
// These are used internally by getCache() but don't need to be exported
