// Service Worker - Optimized Caching Strategies
// Version: 2026-01-23 - v3

const CACHE_NAMES = {
  APP_SHELL: 'aks-portfolio-app-v3',
  RUNTIME: 'aks-portfolio-runtime-v3',
  IMAGES: 'aks-portfolio-images-v2',
  TEXTURES: 'aks-portfolio-textures-v2',
  FONTS: 'aks-portfolio-fonts-v2',
  BUNDLES: 'aks-portfolio-bundles-v2',
};

const APP_SHELL = [
  '/',
  '/index.html',
  '/content/styles/main.css',
  '/content/styles/root.css',
  '/content/main.js',
  '/manifest.json',
  '/content/assets/img/icons/favicon-512.png',
];

// Helper: limit cache size
async function trimCache(cacheName, maxEntries = 60) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;
  const toDelete = keys.length - maxEntries;
  await Promise.all(keys.slice(0, toDelete).map((key) => cache.delete(key)));
}

// Static Earth textures - pre-cache for offline reliability
const STATIC_TEXTURES = [
  '/content/assets/img/earth/earth_day.webp',
  '/content/assets/img/earth/earth_night.webp',
  '/content/assets/img/earth/earth_normal.webp',
  '/content/assets/img/earth/earth_bump.webp',
  '/content/assets/img/earth/textures/moon_texture.webp',
  '/content/assets/img/earth/textures/moon_bump.webp',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([
      caches
        .open(CACHE_NAMES.APP_SHELL)
        .then((cache) => cache.addAll(APP_SHELL)),
      caches.open(CACHE_NAMES.TEXTURES).then((cache) =>
        cache.addAll(STATIC_TEXTURES).catch(() => {
          // Graceful fallback if textures don't exist
        }),
      ),
    ]),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  const CURRENT_CACHES = Object.values(CACHE_NAMES);
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (!CURRENT_CACHES.includes(key)) {
            return caches.delete(key);
          }
        }),
      ),
    ),
  );

  // Enable navigation preload if supported
  if ('navigationPreload' in self.registration) {
    try {
      self.registration.navigationPreload.enable();
    } catch (e) {
      // Ignore
    }
  }
  self.clients.claim();
});

// Optimized fetch with per-asset-type caching strategies
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if (req.method !== 'GET') return;

  // HTML: network-first (always try fresh content)
  if (req.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      (async () => {
        const preloaded = await event.preloadResponse;
        if (preloaded) {
          const copy = preloaded.clone();
          caches
            .open(CACHE_NAMES.RUNTIME)
            .then((cache) => cache.put(req, copy));
          return preloaded;
        }
        return fetch(req)
          .then((res) => {
            const copy = res.clone();
            caches
              .open(CACHE_NAMES.RUNTIME)
              .then((cache) => cache.put(req, copy));
            return res;
          })
          .catch(() =>
            caches.match(req).then((res) => res || caches.match('/index.html')),
          );
      })(),
    );
    return;
  }

  // Earth textures: cache-first (static assets)
  if (url.pathname.match(/\/content\/assets\/img\/earth\/.*\.(webp|png)$/i)) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((res) => {
          if (res.ok) {
            caches
              .open(CACHE_NAMES.TEXTURES)
              .then((cache) => cache.put(req, res.clone()));
          }
          return res;
        });
      }),
    );
    return;
  }

  // Fonts & external bundles: cache-first
  if (
    url.pathname.match(/\.(woff2?|ttf|otf|eot)$/i) ||
    url.origin !== self.location.origin
  ) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((res) => {
          if (res.ok) {
            const cacheName = url.pathname.match(/\.(woff2?|ttf|otf|eot)$/i)
              ? CACHE_NAMES.FONTS
              : CACHE_NAMES.BUNDLES;
            caches.open(cacheName).then((cache) => cache.put(req, res.clone()));
          }
          return res;
        });
      }),
    );
    return;
  }

  // Images: cache-first
  if (url.pathname.match(/\.(jpg|jpeg|png|gif|svg|webp|ico|avif)$/i)) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((res) => {
          if (res.ok) {
            caches
              .open(CACHE_NAMES.IMAGES)
              .then((cache) => cache.put(req, res.clone()));
          }
          return res;
        });
      }),
    );
    return;
  }

  // JS/CSS: network-first
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAMES.RUNTIME).then((cache) => {
            cache.put(req, copy);
            trimCache(CACHE_NAMES.RUNTIME, 80);
          });
        }
        return res;
      })
      .catch(() => caches.match(req)),
  );
});
