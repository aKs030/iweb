// ===========================
// iweb Service Worker v2.1
// ===========================

// Versionierte Cache-Namen zur Vermeidung von Konflikten
const CACHE_VERSION = 'v2.1';
const CACHE_NAME = `iweb-cache-${CACHE_VERSION}`;

// Ressourcen, die immer offline verfügbar sein sollen
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/content/css/main.css',
  '/content/js/main.js',
  '/content/webentwicklung/footer/footer-complete.js',
  '/content/webentwicklung/menu/menu.js',
  '/content/img/icons/favicon.svg',
];

// ------------------------------------------------------
// INSTALLATION
// ------------------------------------------------------
self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Installing version:', CACHE_NAME);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
      .catch((err) => console.error('[SW] Cache install failed:', err))
  );
});

// ------------------------------------------------------
// AKTIVIERUNG & ALTEN CACHE ENTFERNEN
// ------------------------------------------------------
self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activated:', CACHE_NAME);
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith('iweb-cache-') && key !== CACHE_NAME)
          .map((oldKey) => {
            console.log('[SW] Deleting old cache:', oldKey);
            return caches.delete(oldKey);
          })
      )
    )
  );
  self.clients.claim();
});

// ------------------------------------------------------
// FETCH-HANDLER
// ------------------------------------------------------
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Ignoriere Chrome Extension Requests
  if (req.url.startsWith('chrome-extension')) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        // Nur GET-Requests cachen
        if (req.method === 'GET') {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
        }
        return res;
      })
      .catch(() =>
        caches.match(req).then((cachedRes) => {
          // Fallback für HTML-Seiten
          if (req.headers.get('accept')?.includes('text/html')) {
            console.warn('[SW] Offline fallback for:', req.url);
            return caches.match('/offline.html');
          }
          return cachedRes;
        })
      )
  );
});

// ------------------------------------------------------
// MANUELLE AKTUALISIERUNG (optional, z. B. über UI-Button)
// ------------------------------------------------------
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});