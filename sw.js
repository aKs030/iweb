// sw.js – Ausgefeilteres Cache‑Konzept mit unterschiedlichen Strategien

/* ======================
   Konstante Cache‑Namen
   ====================== */
const STATIC_CACHE  = 'abdulkerim-static-v1';
const RUNTIME_CACHE = 'abdulkerim-runtime-v1';
const IMAGE_CACHE   = 'abdulkerim-images-v1';

/* =========================
   Assets, die wir vorab cachen
   ========================= */
const STATIC_ASSETS = [
  '/',                   // Startseite (index.html)
  '/offline.html',       // Offline-Fallback-Seite
  '/css/index.css',
  '/css/menu.css',
  '/img/icon.png'
];

/* ===================================
   Hilfsfunktion: Cache auf Größe trimmen
   =================================== */
async function trimCache(cacheName, maxItems) {
  const cache = await caches.open(cacheName);
  const keys  = await cache.keys();
  if (keys.length > maxItems) {
    await cache.delete(keys[0]);
    return trimCache(cacheName, maxItems); // rekursiv, bis Limit erreicht
  }
}

/* =========
   INSTALL
   ========= */
self.addEventListener('install', event => {
  // Neue SW‑Version sofort aktivieren
  self.skipWaiting();

  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => cache.addAll(STATIC_ASSETS))
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

  /* 1. Navigations‑Anfragen (HTML‑Dokumente)
        → Network‑First mit Cache‑Fallback              */
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Nur gültige, nicht-umgeleitete Antworten cachen
          if (response.ok && !response.redirected) {
            const clone = response.clone();
            caches.open(RUNTIME_CACHE).then(cache => cache.put(request, clone));
          }
          // Immer die Netzwerkantwort zurückgeben (Browser behandelt Redirects)
          return response;
        })
        .catch(async () => {
          // Netzwerkfehler: Versuche, die Offline-Seite aus dem Cache zu liefern
          const cachedResponse = await caches.match('/offline.html');
          return cachedResponse; // Liefert die gecachte offline.html oder undefined
        })
    );
    return; // Wichtig: Beendet die Funktion nach Behandlung von 'navigate'
  }

  /* 2. CSS, JS, Worker
        → Stale‑While‑Revalidate                        */
  if (['style', 'script', 'worker'].includes(dest)) {
    event.respondWith(
      caches.match(request).then(cached => {
        const networkFetch = fetch(request)
          .then(response => {
            const clone = response.clone();
            caches.open(RUNTIME_CACHE)
                  .then(cache => cache.put(request, clone))
                  .then(() => trimCache(RUNTIME_CACHE, 50));
            return response;
          })
          .catch(() => cached); // Fallback, wenn Netzwerk down
        return cached || networkFetch;
      })
    );
    return;
  }

  /* 3. Bilder
        → Cache‑First + Begrenzung auf 50 Einträge       */
  if (dest === 'image') {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;

        return fetch(request)
          .then(response => {
            const clone = response.clone();
            caches.open(IMAGE_CACHE)
                  .then(cache => cache.put(request, clone))
                  .then(() => trimCache(IMAGE_CACHE, 50));
            return response;
          });
      })
    );
    return;
  }

  /* 4. Alles andere → Standard‑Fetch (kein Eingriff) */
});