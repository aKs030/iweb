/* global self, caches */
// Basic Service Worker for offline caching
// Strategy:
//  - Precache core shell (root assets)
//  - Runtime cache: images & pages (stale-while-revalidate)
//  - Fonts: cache-first

const SW_VERSION = 'v1.2.0'; // Nach utils-Auflösung (Dezember 2025)
const CORE = [
  '/',
  '/index.html',
  '/content/webentwicklung/root.css',
  '/content/webentwicklung/index.css',
  '/content/webentwicklung/main.js',
  '/content/webentwicklung/shared-utilities.js'
];

const CACHE_NAMES = {
  CORE: `core-${SW_VERSION}`,
  CORE_DYN: `core-dyn-${SW_VERSION}`,
  IMG: `img-${SW_VERSION}`
};

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAMES.CORE);
    // addAll sollte komplett funktionieren; wenn nicht, SW trotzdem aktivierbar
    await cache.addAll(CORE).catch(() => {});
    // Sofortiger Activate-Wunsch
    self.skipWaiting?.();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keep = new Set(Object.values(CACHE_NAMES));
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => !keep.has(k)).map(k => caches.delete(k)));
    await self.clients?.claim?.();
  })());
});

function cacheFirst(request) {
  return caches.match(request).then(hit => hit || fetch(request));
}

function staleWhileRevalidate(request, cacheName) {
  return caches.open(cacheName).then(cache =>
    cache.match(request).then(resp => {
      const fetchPromise = fetch(request).then(networkResp => {
        cache.put(request, networkResp.clone());
        return networkResp;
      }).catch(() => resp);
      return resp || fetchPromise;
    })
  );
}

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET') return;

  // Fonts cache-first
  if (url.pathname.startsWith('/content/webentwicklung/fonts/')) {
    event.respondWith(cacheFirst(request));
    return;
  }
  // Images stale-while-revalidate
  if (url.pathname.startsWith('/content/img/')) {
    event.respondWith(staleWhileRevalidate(request, CACHE_NAMES.IMG));
    return;
  }
  // Pages & CSS/JS core fallback
  if (CORE.includes(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request, CACHE_NAMES.CORE_DYN));
  }
});
