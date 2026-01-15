// Minimal Service Worker for offline cache and reliability
// Version: 2026-01-15

const CACHE_NAME = 'aks-portfolio-v1';
const APP_SHELL = [
    '/',
    '/index.html',
    '/content/styles/main.css',
    '/content/styles/root.css',
    '/content/main.js',
    '/manifest.json',
    '/content/assets/img/icons/favicon-512.png',
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) return caches.delete(key);
                })
            )
        )
    );
    self.clients.claim();
});

// Network-first for HTML, cache-first for static assets
self.addEventListener('fetch', (event) => {
    const req = event.request;
    const isHTML = req.headers.get('accept')?.includes('text/html');
    if (isHTML) {
        event.respondWith(
            fetch(req)
                .then((res) => {
                    const copy = res.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
                    return res;
                })
                .catch(() => caches.match(req).then((res) => res || caches.match('/index.html')))
        );
        return;
    }
    event.respondWith(
        caches.match(req).then((cached) => cached || fetch(req))
    );
});
