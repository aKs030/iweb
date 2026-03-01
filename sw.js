/**
 * Service Worker v6 — Cache-Limits, Update-Notification, Reload-Loop-safe
 * Navigation: Network-only mit Offline-Fallback
 * Bilder/Fonts/3D: Cache-first mit Size-Limits
 * JS/CSS: Kein SW-Caching (Browser-HTTP-Cache übernimmt)
 * API/Externe: Ignoriert
 */

// Cache-Name mit Version — bei Deployments hochzählen
const CACHE = 'static-v2';
const OFFLINE = '/offline.html';
const MAX_CACHE_ITEMS = 80; // Max cached assets (images, fonts, models)

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
