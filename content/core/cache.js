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
    const resolved = resolveFreshCacheItem(item, () => this.cache.delete(key));
    if (!resolved) return null;

    // Move to end for LRU ordering
    this.cache.delete(key);
    this.cache.set(key, resolved);

    return resolved.value;
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

function isExpired(item) {
  return Boolean(item?.expires && item.expires < Date.now());
}

function resolveFreshCacheItem(item, onExpire) {
  if (!item) return null;
  if (!isExpired(item)) return item;
  onExpire?.();
  return null;
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
        const db = /** @type {any} */ (event.target).result;
        if (!db.objectStoreNames.contains('cache')) {
          db.createObjectStore('cache', { keyPath: 'key' });
        }
      };
    });
  }

  /** Wraps an IDBRequest in a Promise */
  _requestToPromise(request, successValue) {
    return new Promise((resolve, reject) => {
      request.addEventListener(
        'success',
        () => resolve(successValue ?? request.result),
        { once: true },
      );
      request.addEventListener('error', () => reject(request.error), {
        once: true,
      });
    });
  }

  async _withStore(mode, operation) {
    await this.init();
    const transaction = this.db.transaction(['cache'], mode);
    const store = transaction.objectStore('cache');
    return operation(store);
  }

  async _runSafely(label, fallback, operation) {
    try {
      return await operation();
    } catch (error) {
      log.warn(`IndexedDB ${label} failed:`, error);
      return fallback;
    }
  }

  async get(key) {
    return this._runSafely('get', null, async () => {
      const item = await this._withStore('readonly', (store) =>
        this._requestToPromise(store.get(key)),
      );
      const resolved = resolveFreshCacheItem(item, () => this.delete(key));
      if (!resolved) return null;

      return resolved.value;
    });
  }

  async set(key, value, ttl = 3600000) {
    return this._runSafely('set', false, () =>
      this._withStore('readwrite', (store) =>
        this._requestToPromise(
          store.put({
            key,
            value,
            expires: ttl ? Date.now() + ttl : null,
            created: Date.now(),
          }),
          true,
        ),
      ),
    );
  }

  async delete(key) {
    return this._runSafely('delete', false, () =>
      this._withStore('readwrite', (store) =>
        this._requestToPromise(store.delete(key), true),
      ),
    );
  }

  async clear() {
    return this._runSafely('clear', false, () =>
      this._withStore('readwrite', (store) =>
        this._requestToPromise(store.clear(), true),
      ),
    );
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

  /**
   * Check if a key exists (in memory or IndexedDB)
   * @param {string} key
   * @returns {Promise<boolean>}
   */
  async has(key) {
    const value = await this.get(key);
    return value !== null;
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
