/* global self, caches */
// Basic Service Worker for offline caching
// Strategy:
//  - Precache core shell (root assets)
//  - Runtime cache: images & pages (stale-while-revalidate)
//  - Fonts: cache-first

const VERSION = 'v1';
const CORE = [
  '/',
  '/index.html',
  '/content/webentwicklung/root.css',
  '/content/webentwicklung/index.css',
  '/content/webentwicklung/main.js',
  '/content/webentwicklung/utils/common-utils.js',
  '/content/webentwicklung/utils/logger.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open('core-' + VERSION).then(cache => cache.addAll(CORE))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => !k.endsWith(VERSION)).map(k => caches.delete(k))
    ))
  );
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
    event.respondWith(staleWhileRevalidate(request, 'img-' + VERSION));
    return;
  }
  // Pages & CSS/JS core fallback
  if (CORE.includes(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request, 'core-dyn-' + VERSION));
  }
});
