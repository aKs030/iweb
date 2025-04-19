const CACHE_NAME = 'iweb-cache-v2';
const ASSETS_TO_CACHE = [
  '/index.html',
  '/css/index.css',
  '/css/menu.css',
  '/js/intext.js',
  '/js/menu.js',
  '/manifest.json',
  '/img/icon-192.png',
  '/img/icon-512.png',
  '/pages/album.html',
  '/pages/ubermich.html',
  '/pages/index-game.html',
  // ...weitere Assets, die sicher keine Redirects enthalten...
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(cacheNames =>
      Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => caches.delete(name))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
      .catch(() => {
        // Optional: Fallback z.B. auf index.html
      })
  );
});
