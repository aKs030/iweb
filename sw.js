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
  // '/',  // Entfernt, um Redirect-Probleme zu vermeiden
  '/index.html', '/offline.html', // Stelle sicher, dass offline.html hier aufgeführt ist
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
      .then(async cache => {
        console.log('[SW] Pre-caching static assets...');
        // Nur Responses ohne Redirect cachen
        const requests = STATIC_ASSETS.map(async url => {
          try {
            const request = new Request(url, { redirect: 'follow' }); // Explizit Umleitungen folgen
            const response = await fetch(request, { cache: 'reload' });
            // Strengere Prüfung: ok, basic type UND nicht umgeleitet
            if (response.ok && response.type === 'basic' && !response.redirected) {
              console.log(`[SW] Caching ${url} - Status: ${response.status}`);
              await cache.put(url, response); // Original-URL als Schlüssel verwenden
              // Spezifisches Logging für offline.html
              if (url === '/offline.html') {
                console.log('[SW] offline.html successfully cached during install.');
              }
            } else {
              console.warn(`[SW] Skipping cache for ${url} - Status: ${response.status}, Type: ${response.type}, Redirected: ${response.redirected}`);
              // Spezifisches Logging für offline.html Fehler
              if (url === '/offline.html') {
                console.error('[SW] FAILED to cache offline.html during install due to response status/type/redirect.');
              }
            }
          } catch (err) {
            console.error(`[SW] Failed to fetch and cache ${url}:`, err);
            // Spezifisches Logging für offline.html Fehler
            if (url === '/offline.html') {
              console.error('[SW] FAILED to cache offline.html during install due to fetch error:', err);
            }
          }
        });
        await Promise.all(requests);
        console.log('[SW] Static assets pre-cached successfully.');
      })
      .catch(err => console.error('[SW] Static cache opening/putting error:', err))
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
  const url = new URL(request.url);

  // Ignoriere Anfragen für Chrome-Erweiterungen oder nicht-HTTP/HTTPS-Protokolle
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // 1. Navigations- und HTML-Anfragen → Network-First mit Offline-Fallback
  if (
    request.mode === 'navigate' ||
    (request.headers.get('accept') && request.headers.get('accept').includes('text/html'))
  ) {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Nur erfolgreiche 'basic'-Antworten ohne Weiterleitung cachen
          if (response.ok && response.type === 'basic' && !response.redirected) {
            const clone = response.clone();
            caches.open(RUNTIME_CACHE).then(cache => cache.put(request, clone));
          } else if (!response.ok) {
            console.warn(`[SW] Network response for ${request.url} was not ok: ${response.status}`);
          } else if (response.redirected) {
            console.warn(`[SW] Network response for ${request.url} was redirected, not caching.`);
          }
          // Immer die Originalantwort zurückgeben (auch bei Fehlern wie 404 oder Redirects)
          return response;
        })
        .catch(async error => { // async hinzugefügt für await caches.keys()
          console.warn(`[SW] Network fetch failed for ${request.url}:`, error);
          // Nur bei echten Netzwerkfehlern (TypeError) offline.html liefern
          if (error instanceof TypeError) {
            console.log('[SW] Network error detected. Attempting to serve offline page.');
            // Versuche explizit aus dem STATIC_CACHE zu laden
            try {
              const cache = await caches.open(STATIC_CACHE);
              const offlineResponse = await cache.match('/offline.html');

              if (offlineResponse) {
                console.log('[SW] Serving offline page from cache.');
                return offlineResponse;
              } else {
                // Zusätzliches Debugging, wenn offline.html nicht gefunden wird
                console.error('[SW] CRITICAL: offline.html not found in STATIC_CACHE!');
                const keys = await cache.keys();
                console.log(`[SW] Keys currently in ${STATIC_CACHE}:`, keys.map(k => k.url));
                const cacheExists = await caches.has(STATIC_CACHE);
                console.log(`[SW] Does ${STATIC_CACHE} exist? ${cacheExists}`);

                return new Response('Offline page not available in cache.', {
                  status: 503,
                  statusText: 'Service Unavailable (Offline Page Missing)',
                  headers: { 'Content-Type': 'text/plain' }
                });
              }
            } catch (cacheError) {
              console.error('[SW] Error opening/accessing STATIC_CACHE for offline page:', cacheError);
              return new Response('Error accessing cache for offline page.', {
                status: 500,
                statusText: 'Internal Server Error (Cache Access)',
                headers: { 'Content-Type': 'text/plain' }
              });
            }
          }
          // Bei anderen Fehlern (z.B. Serverfehler, die nicht gecacht wurden) eine generische Fehlermeldung
          console.error('[SW] Fetch error (non-TypeError):', error);
          return new Response('Ein Fehler ist aufgetreten.', {
            status: 500, // Oder einen passenderen Statuscode
            statusText: 'Internal Error',
            headers: { 'Content-Type': 'text/plain' }
          });
        })
    );
    return;
  }

  // 2. CSS, JS, Worker → Stale‑While‑Revalidate
  if (['style', 'script', 'worker'].includes(dest)) {
    event.respondWith(
      caches.match(request).then(cached => {
        const networkFetch = fetch(request)
          .then(response => {
            // Nur erfolgreiche 'basic'-Antworten ohne Umleitung cachen
            if (response.ok && response.type === 'basic' && !response.redirected) {
              const clone = response.clone();
              caches.open(RUNTIME_CACHE)
                .then(cache => cache.put(request, clone))
                .then(() => trimCache(RUNTIME_CACHE, 50));
            } else if (response.redirected) {
                console.warn(`[SW] Stale-While-Revalidate: Response for ${request.url} was redirected, not caching.`);
            }
            return response;
          })
          .catch(() => {
            // Nur zurückgeben, wenn etwas im Cache war
            if (cached) return cached;
            // Ansonsten einen Fehler simulieren oder nichts tun
            // Hier könnte man eine generische Fehlerantwort für Assets geben
            return new Response(`Asset ${request.url} not available offline.`, {
              status: 404,
              statusText: 'Not Found',
              headers: { 'Content-Type': 'text/plain' }
            });
          });
        // Gibt gecachte Version zurück oder wartet auf Netzwerkantwort
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
            // Nur erfolgreiche 'basic'-Antworten ohne Umleitung cachen
            if (response.ok && response.type === 'basic' && !response.redirected) {
              const clone = response.clone();
              caches.open(IMAGE_CACHE)
                .then(cache => cache.put(request, clone))
                .then(() => trimCache(IMAGE_CACHE, 50));
            } else if (response.redirected) {
                console.warn(`[SW] Cache-First (Image): Response for ${request.url} was redirected, not caching.`);
            }
            return response;
          })
          .catch(() =>
            // Optional: Platzhalterbild ausliefern, falls vorhanden
            caches.match('/img/placeholder.png').then(placeholder =>
              placeholder || new Response('Image not available offline.', {
                status: 404, statusText: 'Not Found', headers: { 'Content-Type': 'text/plain' }
              })
            )
          );
      })
    );
    return;
  }

  // 4. Alles andere → Standard‑Fetch (kein Caching durch den SW)
  // event.respondWith(fetch(request)); // Explizit machen, dass wir hier nicht eingreifen wollen, außer Standard-Fetch
});