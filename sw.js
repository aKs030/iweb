/**
 * Verbesserter Service Worker
 * Strategie:
 * - HTML: Network First (Inhalt ist immer frisch, Fallback auf Cache wenn offline)
 * - Assets (CSS, JS, Images): Stale-While-Revalidate (Schnell laden, im Hintergrund aktualisieren)
 * - Externe Ressourcen: Cache First
 */

const CACHE_NAME = 'iweb-cache-v2'; // Versionierung erhöhen, um alten Cache zu löschen
const OFFLINE_URL = '/offline.html';

const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/offline.html',
    '/manifest.json',
    '/content/styles/main.css',
    '/content/styles/root.css',
    '/content/main.js',
    '/content/assets/img/icons/favicon.svg'
];

// Install: Cache wichtige Dateien vor
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[Service Worker] Caching static assets');
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
    self.skipWaiting(); // Aktiviert den neuen SW sofort
});

// Activate: Alte Caches aufräumen
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[Service Worker] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim(); // Kontrolliert sofort alle Clients
});

// Fetch: Strategien anwenden
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // 1. Navigation Requests (HTML) -> Network First
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    // Gültige Antwort cachen
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
                    return response;
                })
                .catch(() => {
                    // Wenn offline, zeige gecachte Seite oder Offline-Seite
                    return caches.match(request).then((cachedResponse) => {
                        return cachedResponse || caches.match(OFFLINE_URL);
                    });
                })
        );
        return;
    }

    // 2. Statische Assets (CSS, JS, Bilder) -> Stale-While-Revalidate
    // Liefert sofort aus dem Cache, aktualisiert aber im Hintergrund für das nächste Mal
    if (
        request.destination === 'style' ||
        request.destination === 'script' ||
        request.destination === 'image' ||
        request.destination === 'font'
    ) {
        event.respondWith(
            caches.match(request).then((cachedResponse) => {
                const fetchPromise = fetch(request).then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                        const responseClone = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
                    }
                    return networkResponse;
                }).catch(err => console.log('Fetch error for asset', err));

                return cachedResponse || fetchPromise;
            })
        );
        return;
    }

    // 3. Default -> Network Only (API calls, etc.)
    event.respondWith(fetch(request));
});
