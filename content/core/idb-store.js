/**
 * IndexedDB Store — lightweight wrapper for offline-first data persistence.
 *
 * Provides typed stores for:
 * - Chat history (Robot Companion conversations)
 * - Analytics event queue (Background Sync)
 * - Generic key-value cache
 *
 * Uses the native IndexedDB API directly (no external lib) to keep the
 * Service Worker and main-thread bundles small.
 *
 * @module idb-store
 * @version 1.0.0
 */

// ---------------------------------------------------------------------------
// Database constants
// ---------------------------------------------------------------------------

const DB_NAME = 'aks-offline';
const DB_VERSION = 1;

/** @type {IDBDatabase | null} */
let _db = null;

/** Store names */
export const STORES = Object.freeze({
  CHAT_HISTORY: 'chat-history',
  ANALYTICS_QUEUE: 'analytics-queue',
  KV_CACHE: 'kv-cache',
});

// ---------------------------------------------------------------------------
// Open / upgrade
// ---------------------------------------------------------------------------

/**
 * Open (or create) the IndexedDB database.
 * Returns a cached instance on subsequent calls.
 *
 * @returns {Promise<IDBDatabase>}
 */
export function openDB() {
  if (_db) return Promise.resolve(_db);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = /** @type {IDBOpenDBRequest} */ (event.target).result;

      // Chat history — auto-incrementing id, indexed by timestamp
      if (!db.objectStoreNames.contains(STORES.CHAT_HISTORY)) {
        const chatStore = db.createObjectStore(STORES.CHAT_HISTORY, {
          keyPath: 'id',
          autoIncrement: true,
        });
        chatStore.createIndex('timestamp', 'timestamp', { unique: false });
        chatStore.createIndex('sessionId', 'sessionId', { unique: false });
      }

      // Analytics event queue — auto-incrementing id, indexed by timestamp
      if (!db.objectStoreNames.contains(STORES.ANALYTICS_QUEUE)) {
        const analyticsStore = db.createObjectStore(STORES.ANALYTICS_QUEUE, {
          keyPath: 'id',
          autoIncrement: true,
        });
        analyticsStore.createIndex('timestamp', 'timestamp', { unique: false });
      }

      // Generic key-value cache (for offline fallback data)
      if (!db.objectStoreNames.contains(STORES.KV_CACHE)) {
        db.createObjectStore(STORES.KV_CACHE, { keyPath: 'key' });
      }
    };

    request.onsuccess = (event) => {
      _db = /** @type {IDBOpenDBRequest} */ (event.target).result;
      resolve(_db);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

// ---------------------------------------------------------------------------
// Generic CRUD helpers
// ---------------------------------------------------------------------------

/**
 * Execute a read-write transaction on a single store.
 *
 * @template T
 * @param {string} storeName
 * @param {'readonly' | 'readwrite'} mode
 * @param {(store: IDBObjectStore) => IDBRequest<T>} operation
 * @returns {Promise<T>}
 */
async function tx(storeName, mode, operation) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    const request = operation(store);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Put a record (insert or update).
 *
 * @param {string} storeName
 * @param {*} value
 * @returns {Promise<IDBValidKey>}
 */
export function put(storeName, value) {
  return tx(storeName, 'readwrite', (store) => store.put(value));
}

/**
 * Get a record by key.
 *
 * @param {string} storeName
 * @param {IDBValidKey} key
 * @returns {Promise<any>}
 */
export function get(storeName, key) {
  return tx(storeName, 'readonly', (store) => store.get(key));
}

/**
 * Get all records from a store.
 *
 * @param {string} storeName
 * @returns {Promise<any[]>}
 */
export function getAll(storeName) {
  return tx(storeName, 'readonly', (store) => store.getAll());
}

/**
 * Delete a record by key.
 *
 * @param {string} storeName
 * @param {IDBValidKey} key
 * @returns {Promise<undefined>}
 */
export function del(storeName, key) {
  return tx(storeName, 'readwrite', (store) => store.delete(key));
}

/**
 * Clear all records from a store.
 *
 * @param {string} storeName
 * @returns {Promise<undefined>}
 */
export function clear(storeName) {
  return tx(storeName, 'readwrite', (store) => store.clear());
}

// ---------------------------------------------------------------------------
// Analytics Queue API
// ---------------------------------------------------------------------------

/**
 * Queue an analytics event for later sending (e.g. when offline).
 *
 * @param {{ event: string, params?: Record<string, any> }} eventData
 * @returns {Promise<IDBValidKey>}
 */
export function queueAnalyticsEvent(eventData) {
  return put(STORES.ANALYTICS_QUEUE, {
    ...eventData,
    timestamp: Date.now(),
    sent: false,
  });
}

/**
 * Get all unsent analytics events.
 *
 * @returns {Promise<Array<{ id: number, event: string, timestamp: number, params?: any }>>}
 */
export async function getQueuedAnalyticsEvents() {
  const all = await getAll(STORES.ANALYTICS_QUEUE);
  return all.filter((e) => !e.sent);
}

/**
 * Flush queued analytics events by sending them to the analytics endpoint.
 * Returns the number of successfully sent events.
 *
 * @param {string} [endpoint='/api/analytics']
 * @returns {Promise<number>}
 */
export async function flushAnalyticsQueue(endpoint = '/api/analytics') {
  const events = await getQueuedAnalyticsEvents();
  if (events.length === 0) return 0;

  let sentCount = 0;

  for (const event of events) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: event.event,
          params: event.params || {},
          timestamp: event.timestamp,
        }),
        // Use keepalive for reliability during page close
        keepalive: true,
      });

      if (response.ok) {
        await del(STORES.ANALYTICS_QUEUE, event.id);
        sentCount++;
      }
    } catch {
      // Event stays in queue for next sync attempt
      break;
    }
  }

  return sentCount;
}
