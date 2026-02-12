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

    // Move to end for LRU ordering
    this.cache.delete(key);
    this.cache.set(key, item);

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

  /** Wraps an IDBRequest in a Promise */
  _requestToPromise(request, successValue) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(successValue ?? request.result);
      request.onerror = () => reject(request.error);
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
      const transaction = this.db.transaction(['cache'], 'readwrite');
      const store = transaction.objectStore('cache');
      const request = store.put({
        key,
        value,
        expires: ttl ? Date.now() + ttl : null,
        created: Date.now(),
      });
      return await this._requestToPromise(request, true);
    } catch (error) {
      log.warn('IndexedDB set failed:', error);
      return false;
    }
  }

  async delete(key) {
    try {
      await this.init();
      const transaction = this.db.transaction(['cache'], 'readwrite');
      const store = transaction.objectStore('cache');
      return await this._requestToPromise(store.delete(key), true);
    } catch (error) {
      log.warn('IndexedDB delete failed:', error);
      return false;
    }
  }

  async clear() {
    try {
      await this.init();
      const transaction = this.db.transaction(['cache'], 'readwrite');
      const store = transaction.objectStore('cache');
      return await this._requestToPromise(store.clear(), true);
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
    this.initPromise = null;

    // Pre-initialize IndexedDB if enabled
    if (this.useIndexedDB) {
      this.initPromise = this.idb.init().catch((error) => {
        log.warn('IndexedDB initialization failed, using memory only:', error);
        this.useIndexedDB = false;
      });
    }
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
      // Ensure IndexedDB is initialized
      if (this.initPromise) await this.initPromise;

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
      // Ensure IndexedDB is initialized
      if (this.initPromise) await this.initPromise;
      await this.idb.set(key, value, ttl);
    }

    log.debug(`Cache set: ${key}`);
  }

  /**
   * Batch set multiple cache entries
   * @param {Array<{key: string, value: any, options?: Object}>} entries
   */
  async setMany(entries) {
    for (const entry of entries) {
      await this.set(entry.key, entry.value, entry.options);
    }
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
