/**
 * Service Worker v7 — Offline-First mit Background Sync & IndexedDB
 *
 * Navigation: Network-only mit Offline-Fallback
 * Bilder/Fonts/3D: Cache-first mit Size-Limits
 * JS/CSS: Kein SW-Caching (Browser-HTTP-Cache übernimmt)
 * API/Externe: Ignoriert
 * NEU: Background Sync für Analytics-Events & Chat-Daten
 * NEU: IndexedDB-basierte Analytics-Queue wird bei Reconnect geflusht
 */

// Cache-Name mit Version — bei Deployments hochzählen
const CACHE = 'static-v3';
const OFFLINE = '/offline.html';
const MAX_CACHE_ITEMS = 80; // Max cached assets (images, fonts, models)

// Background Sync tag names
const SYNC_ANALYTICS = 'sync-analytics';

const SKIP = [
  'cloudflareinsights.com',
  'googletagmanager.com',
  'google-analytics.com',
  'googleapis.com',
  'gstatic.com',
  'esm.sh',
  'cdn.jsdelivr.net',
  'unpkg.com',
];

// ---------------------------------------------------------------------------
// IndexedDB helpers (self-contained for Service Worker context)
// ---------------------------------------------------------------------------

const IDB_NAME = 'aks-offline';
const IDB_VERSION = 1;
const STORE_ANALYTICS = 'analytics-queue';

/**
 * Open (or create) the IndexedDB database inside the SW.
 * Mirrors the store schema from content/core/idb-store.js.
 * @returns {Promise<IDBDatabase>}
 */
function openIDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('chat-history')) {
        const cs = db.createObjectStore('chat-history', {
          keyPath: 'id',
          autoIncrement: true,
        });
        cs.createIndex('timestamp', 'timestamp', { unique: false });
        cs.createIndex('sessionId', 'sessionId', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_ANALYTICS)) {
        const as = db.createObjectStore(STORE_ANALYTICS, {
          keyPath: 'id',
          autoIncrement: true,
        });
        as.createIndex('timestamp', 'timestamp', { unique: false });
      }
      if (!db.objectStoreNames.contains('kv-cache')) {
        db.createObjectStore('kv-cache', { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Flush all queued analytics events from IndexedDB → POST /api/analytics.
 * @returns {Promise<number>} Number of successfully sent events
 */
async function flushAnalyticsFromIDB() {
  let db;
  try {
    db = await openIDB();
  } catch {
    return 0;
  }

  const events = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ANALYTICS, 'readonly');
    const store = tx.objectStore(STORE_ANALYTICS);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });

  const unsent = events.filter((e) => !e.sent);
  if (!unsent.length) return 0;

  let sentCount = 0;

  for (const event of unsent) {
    try {
      const res = await fetch('/api/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: event.event,
          params: event.params || {},
          timestamp: event.timestamp,
        }),
      });

      if (res.ok) {
        // Delete from IDB on success
        await new Promise((resolve, reject) => {
          const tx = db.transaction(STORE_ANALYTICS, 'readwrite');
          const store = tx.objectStore(STORE_ANALYTICS);
          const req = store.delete(event.id);
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        });
        sentCount++;
      }
    } catch {
      // Network still down — stop trying, leave remaining events in queue
      break;
    }
  }

  return sentCount;
}

// ---------------------------------------------------------------------------
// Cache management
// ---------------------------------------------------------------------------

/**
 * Trim cache to MAX_CACHE_ITEMS (LRU: oldest first)
 * @param {string} cacheName
 */
async function trimCache(cacheName) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > MAX_CACHE_ITEMS) {
    const toDelete = keys.slice(0, keys.length - MAX_CACHE_ITEMS);
    await Promise.all(toDelete.map((key) => cache.delete(key)));
  }
}

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.add(OFFLINE)));
  // KEIN skipWaiting() — verhindert Mid-Session-SW-Übernahme, die Reloads auslöst.
  // Neuer SW wartet, bis alle Tabs der alten Version geschlossen sind.
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)),
        ),
      ),
    // clients.claim() NICHT aufrufen — verhindert, dass der neue SW
    // laufende Seiten mitten in der Session übernimmt und dabei
    // ausstehende Requests abbricht oder Reloads auslöst.
  );
});

// Notify clients when a new SW version is waiting
self.addEventListener('message', (e) => {
  if (e.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  // Allow main thread to trigger analytics flush
  if (e.data?.type === 'FLUSH_ANALYTICS') {
    e.waitUntil(flushAnalyticsFromIDB());
  }
});

// ---------------------------------------------------------------------------
// Background Sync — flush queued analytics when connectivity is restored
// ---------------------------------------------------------------------------

self.addEventListener('sync', (e) => {
  if (e.tag === SYNC_ANALYTICS) {
    e.waitUntil(flushAnalyticsFromIDB());
  }
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (!url.protocol.startsWith('http')) return;
  if (SKIP.some((h) => url.hostname.includes(h))) return;
  if (url.pathname.startsWith('/api/')) return;

  // HTML-Navigation: Netzwerk, Offline-Fallback bei Fehler
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request).catch(async () => {
        const c = await caches.open(CACHE);
        return (
          (await c.match(OFFLINE)) || new Response('Offline', { status: 503 })
        );
      }),
    );
    return;
  }

  // Statische Assets (Bilder, Fonts, 3D-Modelle): Cache-first mit Limits
  if (
    ['image', 'font'].includes(request.destination) ||
    /\.(glb|gltf)$/.test(url.pathname)
  ) {
    e.respondWith(
      caches.open(CACHE).then(async (c) => {
        const cached = await c.match(request);
        if (cached) return cached;
        const res = await fetch(request);
        if (res.ok) {
          c.put(request, res.clone());
          // Trim cache in background to respect size limits
          trimCache(CACHE);
        }
        return res;
      }),
    );
  }
});
