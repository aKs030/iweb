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
          // Prüfen, ob die Antwort gültig und erfolgreich ist (Status 200-299)
          if (response.ok) {
            // Antwort klonen, im Runtime-Cache speichern und Original zurückgeben
            const clone = response.clone();
            // Asynchrones Caching, blockiert nicht die Antwort
            caches.open(RUNTIME_CACHE).then(cache => cache.put(request, clone));
            return response;
          }
          // Wenn die Antwort NICHT ok ist (z.B. 404, 500, 3xx),
          // werfe einen Fehler, um den .catch() Block auszulösen und die Offline-Seite zu zeigen.
          // Dies verhindert, dass eine Redirect-Antwort an Safari zurückgegeben wird.
          throw new Error(`Server response not OK: ${response.status} ${response.statusText}`);
        })
        .catch(error => {
          // Netzwerkfehler ODER Server-Antwort war nicht ok.
          console.warn(`Netzwerkanfrage für ${request.url} fehlgeschlagen oder Antwort nicht OK. Liefere Offline-Seite. Fehler:`, error);
          // Offline-Fallback aus dem Cache liefern
          return caches.match('/offline.html').then(offlineResponse => {
            if (offlineResponse) {
              return offlineResponse;
            }
            // Absoluter Fallback, falls offline.html nicht im Cache ist (sollte nicht passieren)
            console.error('Offline-Seite (/offline.html) nicht im Cache gefunden!');
            return new Response('Offline page not available in cache.', {
              status: 503,
              statusText: 'Service Unavailable',
              headers: { 'Content-Type': 'text/plain' }
            });
          });
        })
    );
    return;
  }

  /* 2. CSS, JS, Worker
        → Stale‑While‑Revalidate                        */
  if (['style', 'script', 'worker'].includes(dest)) {
    event.respondWith(
      caches.match(request).then(cached => {
        // Netzwerk-Fetch wird parallel zur Cache-Prüfung gestartet (implizit durch Promise-Ausführung)
        // oder sequenziell nach der Cache-Prüfung (wie hier implementiert).
        // Die sequenzielle Methode ist einfacher, die parallele kann Updates beschleunigen.
        const networkFetch = fetch(request)
          .then(response => {
            // Nur erfolgreiche Antworten cachen
            if (response.ok) {
              const clone = response.clone();
              caches.open(RUNTIME_CACHE)
                    .then(cache => cache.put(request, clone))
                    .then(() => trimCache(RUNTIME_CACHE, 50));
            }
            return response;
          })
          .catch(() => {
            // Netzwerkfehler: Gib gecachte Version zurück, falls vorhanden
            if (cached) {
              return cached;
            }
            // Optional: Hier könnte man auch einen spezifischeren Fallback für Assets anbieten
            // return new Response('Asset not available offline', { status: 404, statusText: 'Not Found' });
          });
        // Gib gecachte Version zurück, falls vorhanden, sonst das Ergebnis des Netzwerk-Fetch
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
        // Wenn im Cache, direkt zurückgeben
        if (cached) return cached;

        // Sonst vom Netzwerk holen
        return fetch(request)
          .then(response => {
            // Nur erfolgreiche Antworten cachen
            if (response.ok) {
              const clone = response.clone();
              caches.open(IMAGE_CACHE)
                    .then(cache => cache.put(request, clone))
                    .then(() => trimCache(IMAGE_CACHE, 50));
            }
            return response;
          })
          .catch(error => {
             // Optional: Fallback-Bild bei Fehler
             console.warn(`Bild ${request.url} konnte nicht geladen werden. Fehler: ${error}`);
             // return caches.match('/img/placeholder.png'); // Beispiel für ein Platzhalterbild
          });
      })
    );
    return;
  }

  /* 4. Alles andere → Standard‑Fetch (kein Eingriff) */
  // Für andere Anfragen wird der Standard-Fetch verwendet.
  // event.respondWith(fetch(request)); // Explizit, aber nicht notwendig, da Standardverhalten
});