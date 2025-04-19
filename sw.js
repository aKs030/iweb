// Service Worker – Verbesserte und optimierte Konfiguration

/* ======================
   Zentrale Cache-Version
   ====================== */
const CACHE_VERSION = 'v2';
const STATIC_CACHE  = `abdulkerim-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `abdulkerim-runtime-${CACHE_VERSION}`;
const IMAGE_CACHE   = `abdulkerim-images-${CACHE_VERSION}`;

/* =========================
   Statische Assets (manuell gepflegt)
   ========================= */
const STATIC_ASSETS = [
  '/', '/index.html', '/offline.html',
  '/css/index.css', '/css/menu.css',
  '/img/icon.png'
];

/* ===================================
   Hilfsfunktion: Cache auf Größe trimmen
   =================================== */
async function trimCache(cacheName, maxItems) {
  const cache = await caches.open(cacheName);
  const keys  = await cache.keys();
  while (keys.length > maxItems) {
    await cache.delete(keys[0]);
    keys.shift();
  }
}

/* =========
   INSTALL
   ========= */
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .catch(err => console.warn('Static cache error:', err))
  );
});

/* ==========
   ACTIVATE
   ========== */
self.addEventListener('activate', event => {
  const allowedCaches = [STATIC_CACHE, RUNTIME_CACHE, IMAGE_CACHE];
  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key => !allowedCaches.includes(key))
            .map(key  => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

/* =======
   FETCH
   ======= */
self.addEventListener('fetch', event => {
  const { request } = event;
  const dest = request.destination;

  // 1. Navigations- und HTML-Anfragen → Network-First mit Offline-Fallback
  if (
    request.mode === 'navigate' ||
    (request.headers.get('accept') && request.headers.get('accept').includes('text/html'))
  ) {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(RUNTIME_CACHE).then(cache => cache.put(request, clone));
            return response;
          }
          throw new Error(`Server response not OK: ${response.status} ${response.statusText}`);
        })
        .catch(() =>
          caches.match('/offline.html').then(offlineResponse =>
            offlineResponse ||
            new Response('Offline page not available in cache.', {
              status: 503,
              statusText: 'Service Unavailable',
              headers: { 'Content-Type': 'text/plain' }
            })
          )
        )
    );
    return;
  }

  // 2. CSS, JS, Worker → Stale‑While‑Revalidate
  if (['style', 'script', 'worker'].includes(dest)) {
    event.respondWith(
      caches.match(request).then(cached => {
        const networkFetch = fetch(request)
          .then(response => {
            if (response.ok) {
              const clone = response.clone();
              caches.open(RUNTIME_CACHE)
                .then(cache => cache.put(request, clone))
                .then(() => trimCache(RUNTIME_CACHE, 50));
            }
            return response;
          })
          .catch(() => cached);
        return cached || networkFetch;
      })
    );
    return;
  }

  // 3. Bilder → Cache‑First + Begrenzung auf 50 Einträge
  if (dest === 'image') {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request)
          .then(response => {
            if (response.ok) {
              const clone = response.clone();
              caches.open(IMAGE_CACHE)
                .then(cache => cache.put(request, clone))
                .then(() => trimCache(IMAGE_CACHE, 50));
            }
            return response;
          })
          .catch(() =>
            // Optional: Platzhalterbild ausliefern, falls vorhanden
            caches.match('/img/placeholder.png')
          );
      })
    );
    return;
  }

  // 4. Alles andere → Standard‑Fetch
  // ...kein Eingriff...
});