/* global self, caches */
// Basic Service Worker for offline caching
// Strategy:
//  - Precache core shell (root assets)
//  - Runtime cache: images & pages (stale-while-revalidate)
//  - Fonts: cache-first

const SW_VERSION = "v1.3.0"; // Version bump: Offline fallback + footer precache
const CORE = [
  "/",
  "/index.html",
  "/content/webentwicklung/root.css",
  "/content/webentwicklung/index.css",
  "/content/webentwicklung/main.js",
  "/content/webentwicklung/shared-utilities.js",
  "/content/webentwicklung/menu/menu.css",
  "/content/webentwicklung/footer/footer.css",
  "/content/webentwicklung/footer/footer.html",
  "/content/webentwicklung/TypeWriter/typewriter.css",
  "/offline.html"
];

const CACHE_NAMES = {
  CORE: `core-${SW_VERSION}`,
  CORE_DYN: `core-dyn-${SW_VERSION}`,
  IMG: `img-${SW_VERSION}`,
  OFFLINE: `offline-${SW_VERSION}`,
};

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAMES.CORE);
      // addAll sollte komplett funktionieren; wenn nicht, SW trotzdem aktivierbar
      await cache.addAll(CORE).catch((err) => { console.warn('sw.js: Core cache addAll failed', err); });
      // Try to fetch a manifest with additional assets (e.g. versioned footer init)
      try {
        const resp = await fetch('/content/webentwicklung/footer/manifest.json', { cache: 'no-store' });
        if (resp && resp.ok) {
          const json = await resp.json();
          if (Array.isArray(json.assets) && json.assets.length) {
            try {
              await cache.addAll(json.assets);
              console.info('sw.js: precached manifest assets:', json.assets);
            } catch (e) {
              console.warn('sw.js: failed to precache manifest assets', e);
            }
          }
        }
      } catch (e) {
        // manifest optional - ignore
      }
      // Ensure offline page is cached (in a specific offline cache)
      try {
        const off = await caches.open(CACHE_NAMES.OFFLINE);
        await off.add('/offline.html').catch(() => {/* ignore */});
      } catch (e) {
        console.warn('sw.js: offline precache failed', e);
      }
      // Sofortiger Activate-Wunsch
      self.skipWaiting?.();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set(Object.values(CACHE_NAMES));
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => !keep.has(k)).map((k) => caches.delete(k))
      );
      await self.clients?.claim?.();
    })()
  );
});

function cacheFirst(request) {
  return caches.match(request).then((hit) => hit || fetch(request));
}

function staleWhileRevalidate(request, cacheName) {
  return caches.open(cacheName).then((cache) =>
    cache.match(request).then((resp) => {
      const fetchPromise = fetch(request)
        .then((networkResp) => {
          cache.put(request, networkResp.clone());
          return networkResp;
        })
        .catch(() => resp);
      return resp || fetchPromise;
    })
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET") return;
  // Fonts cache-first
  if (url.pathname.startsWith("/content/webentwicklung/fonts/")) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Images stale-while-revalidate
  if (url.pathname.startsWith("/content/img/")) {
    event.respondWith(staleWhileRevalidate(request, CACHE_NAMES.IMG));
    return;
  }

  // HTML / navigation requests: Network-first, fallback to cache -> offline
  const accept = request.headers.get('accept') || '';
  if (accept.includes('text/html') || request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((networkResp) => {
          // Update runtime cache for navigations
          const clone = networkResp.clone();
          caches.open(CACHE_NAMES.CORE_DYN).then(c => c.put(request, clone));
          return networkResp;
        })
        .catch(() => caches.match(request).then(hit => hit || caches.match('/offline.html')))
    );
    return;
  }

  // Core assets (CSS/JS etc): stale-while-revalidate to keep them fresh
  if (CORE.includes(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request, CACHE_NAMES.CORE_DYN));
    return;
  }

  // Default: try cache then network, finally offline fallback for navigation-like requests
  event.respondWith(
    caches.match(request).then(hit => hit || fetch(request).catch(() => caches.match('/offline.html')))
  );
});
