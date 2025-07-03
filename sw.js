const CACHE_NAME = 'iweb4-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/css/index.css',
  '/css/_global.css',
  '/js/templateLoader.js',
  '/js/intext.js',
  '/js/menu.js',
  '/js/scroll-dots.js',
  '/img/touch-icon-180.png',
  // …weitere wichtige Assets
];

self.addEventListener('install', evt => {
  evt.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(self.skipWaiting())
  );
});

self.addEventListener('activate', evt => {
  evt.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys
        .filter(k => k !== CACHE_NAME)
        .map(k => caches.delete(k))
      )
    )
    .then(self.clients.claim())
  );
});

self.addEventListener('fetch', evt => {
  evt.respondWith(
    caches.match(evt.request)
      .then(res => res || fetch(evt.request))
  );
});