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
        → Network‑First mit Cache‑Fallback (umgeschrieben mit async/await) */
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {(response => {
          // Versuche zuerst das Netzwerkte Antworten cachen
          const networkResponse = await fetch(request);
            const clone = response.clone();
          // Wenn Netzwerk erfolgreich, ggf. cachen und zurückgebenest, clone));
          // Wichtig: Nur cachen, wenn die Antwort OK ist UND keine Weiterleitung
          // Dies verhindert das Cachen von Fehlerseiten oder Redirects, die offline nicht funktionieren. behandelt Redirects)
          if (networkResponse.ok && !networkResponse.redirected) {
            const cache = await caches.open(RUNTIME_CACHE);
            // Klonen ist wichtig, da eine Response nur einmal gelesen werden kann
            cache.put(request, networkResponse.clone());uche, die Offline-Seite aus dem Cache zu liefern
          }          const cachedResponse = await caches.match('/offline.html');
          // Netzwerkantwort zurückgeben (Browser kümmert sich um Redirects etc. online)sponse; // Liefert die gecachte offline.html oder undefined
          return networkResponse;

        } catch (error) {    return; // Wichtig: Beendet die Funktion nach Behandlung von 'navigate'
          // Netzwerkfehler (offline)
          console.log('Netzwerk-Fetch fehlgeschlagen, versuche offline.html...', error);

          // *** Geänderte Logik: Zuerst die Offline-Seite versuchen ***
          const offlineResponse = await caches.match('/offline.html');].includes(dest)) {
          if (offlineResponse) {espondWith(
            console.log('Liefere offline.html');      caches.match(request).then(cached => {
            return offlineResponse;
          }

          // Optional: Als zweiten Fallback die ursprünglich angeforderte Seite aus dem Cache versuchenCACHE)
          // const cachedResponse = await caches.match(request);che.put(request, clone))
          // if (cachedResponse) {       .then(() => trimCache(RUNTIME_CACHE, 50));
          //   console.log('Gecachte Version der angeforderten Seite gefunden:', request.url);            return response;
          //   return cachedResponse;
          // }

          // Absoluter Fallback, falls offline.html nicht im Cache ist
          console.error('Offline-Seite nicht im Cache gefunden!');
          return new Response("Sie sind offline und die Offline-Seite ist nicht verfügbar.", {
            status: 503,
            statusText: "Service Unavailable",
            headers: { 'Content-Type': 'text/plain' }lder
          });  → Cache‑First + Begrenzung auf 50 Einträge       */
        }
      })() event.respondWith(
    );      caches.match(request).then(cached => {
    return; // Wichtig: Beendet die Funktion nach Behandlung von 'navigate'urn cached;
  }

  /* 2. CSS, JS, Workerse => {
        → Stale‑While‑Revalidate                        */
  if (['style', 'script', 'worker'].includes(dest)) {
    event.respondWith( => cache.put(request, clone))
      caches.match(request).then(cached => {GE_CACHE, 50));
        const networkFetch = fetch(request)
          .then(response => {
            const clone = response.clone();
            caches.open(RUNTIME_CACHE)
                  .then(cache => cache.put(request, clone))
                  .then(() => trimCache(RUNTIME_CACHE, 50));
            return response;
          })Alles andere → Standard‑Fetch (kein Eingriff) */
          .catch(() => cached); // Fallback, wenn Netzwerk down        return cached || networkFetch;      })    );    return;  }  /* 3. Bilder        → Cache‑First + Begrenzung auf 50 Einträge       */  if (dest === 'image') {    event.respondWith(      caches.match(request).then(cached => {        if (cached) return cached;        return fetch(request)          .then(response => {            const clone = response.clone();            caches.open(IMAGE_CACHE)                  .then(cache => cache.put(request, clone))                  .then(() => trimCache(IMAGE_CACHE, 50));            return response;          });      })    );    return;  }

  /* 4. Alles andere → Standard‑Fetch (kein Eingriff) */
});