const CACHE_NAME = 'iweb-cache-v1';
const ASSETS_TO_CACHE = [
  // '/' entfernt, um Redirect-Probleme zu vermeiden
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
  // Weitere Assets nach Bedarf
];

// Installations-Event: Assets cachen (nur Responses ohne Redirect)
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(async cache => {
        // Nur Responses ohne Redirect cachen
        for (const url of ASSETS_TO_CACHE) {
          try {
            const response = await fetch(url, { redirect: "follow" });
            if (response && response.type === 'basic' && response.status === 200) {
              await cache.put(url, response.clone());
            }
          } catch (e) {
            // Fehler beim Caching ignorieren (z.B. offline)
          }
        }
      })
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
