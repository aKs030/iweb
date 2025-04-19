const CACHE_NAME = 'iweb-cache-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/css/index.css',
  '/css/menu.css',
  '/js/intext.js',
  '/js/menu.js',
  '/manifest.json',
  '/img/icon-192.png',
  '/img/icon-512.png',
  // Weitere Seiten/Assets nach Bedarf:
  '/pages/album.html',
  '/pages/ubermich.html',
  '/pages/index-game.html',
  // Fonts und CDN-Ressourcen werden von Browser meist separat gecacht
];

// Installations-Event: Assets cachen
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS_TO_CACHE))
  );
  self.skipWaiting();
});

// Aktivierungs-Event: Alte Caches löschen
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch-Event: Aus Cache oder Netzwerk laden
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});
