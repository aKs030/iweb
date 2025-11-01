// ===========================
// iweb Service Worker v4.1
// ===========================

// Konfiguration
const DEBUG = /localhost|127\.0\.0\.1/.test(self.location.hostname);
const STATIC_CACHE = 'iweb-static-v4';
const DYNAMIC_CACHE = 'iweb-dynamic-v4';
const PAGES_CACHE = 'iweb-pages-v4'; // HTML-Teilseiten separat halten
const MAX_DYNAMIC_ENTRIES = 200;
const OFFLINE_IMAGE = '/content/img/icons/offline.svg';
const PAGES_TTL_MS = 1000 * 60 * 60 * 48; // 48 Stunden nur für Seiten-HTML

// Ressourcen, die immer offline verfügbar sein sollen
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.json',
  // Styles
  '/content/webentwicklung/root.css',
  '/content/webentwicklung/index.css',
  '/content/webentwicklung/menu/menu.css',
  '/pages/home/hero.css',
  '/content/webentwicklung/TypeWriter/typewriter.css',
  '/content/webentwicklung/footer/footer.css',
  '/content/webentwicklung/footer/day-night-artwork.css',
  '/content/webentwicklung/footer/cookie-consent.css',
  '/content/webentwicklung/particles/three-earth.css',
  '/pages/about/about.css',
  '/pages/card/karten.css',
  '/content/webentwicklung/offline.css',
  // Scripts
  '/content/webentwicklung/main.js',
  '/content/webentwicklung/footer/footer-complete.js',
  '/content/webentwicklung/menu/menu.js',
  // HTML Partials
  '/pages/home/hero.html',
  '/pages/card/karten.html',
  '/pages/about/about.html',
  // Icons
  '/content/img/icons/favicon.svg',
  '/content/img/icons/icon-96.png',
  '/content/img/icons/icon-144.png',
  '/content/img/icons/icon-192.png',
  '/content/img/icons/icon-512.png'
];

const log = (...args) => { if (DEBUG) console.log('[SW]', ...args); };
const warn = (...args) => { if (DEBUG) console.warn('[SW]', ...args); };

// ------------------------------------------------------
// INSTALLATION
// ------------------------------------------------------
self.addEventListener('install', (event) => {
  log('Installing…', { STATIC_CACHE, DYNAMIC_CACHE });
  event.waitUntil(
    caches.open(STATIC_CACHE).then(async (cache) => {
      // Install robust: nicht an einer fehlenden Datei scheitern
      await Promise.allSettled(
        STATIC_ASSETS.map((url) =>
          cache.add(url).catch((err) => {
            warn('Skip caching (missing?):', url, err && err.message);
          })
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// ------------------------------------------------------
// AKTIVIERUNG & ALTEN CACHE ENTFERNEN
// ------------------------------------------------------
self.addEventListener('activate', (event) => {
  log('Activated');
  event.waitUntil(
    (async () => {
      // Navigation Preload aktivieren (wo verfügbar)
      if ('navigationPreload' in self.registration) {
        try { await self.registration.navigationPreload.enable(); } catch {}
      }

      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith('iweb-') && key !== STATIC_CACHE && key !== DYNAMIC_CACHE && key !== PAGES_CACHE)
          .map((oldKey) => {
            log('Deleting old cache:', oldKey);
            return caches.delete(oldKey);
          })
      );

      await self.clients.claim();

      // Clients informieren, dass ein Update aktiv ist (optional UI-Hinweis)
      const clients = await self.clients.matchAll({ type: 'window' });
      for (const client of clients) {
        try { client.postMessage({ type: 'SW_ACTIVATED', version: 'v4.0' }); } catch {}
      }
    })()
  );
});

// Hilfsfunktionen
function isAnalytics(url) {
  return /google-analytics\.com|googletagmanager\.com|gtag\/js|clarity\.ms|hotjar\.com/.test(url);
}

function isSameOrigin(url) {
  try { return new URL(url).origin === self.location.origin; } catch { return false; }
}

async function safePut(cacheName, req, res) {
  try {
    // Nur erfolgreiche, nicht-opaque Responses cachen
    if (res && res.ok && (res.type === 'basic' || res.type === 'default')) {
      // Für Seiten-HTML: Stempel hinzufügen, um TTL zu ermöglichen
      const stamped = (cacheName === PAGES_CACHE)
        ? stampResponse(res)
        : res;
      const cache = await caches.open(cacheName);
      await cache.put(req, stamped.clone());
      // Optional: Cache begrenzen
      if (cacheName === DYNAMIC_CACHE) {
        try {
          const keys = await cache.keys();
          if (keys.length > MAX_DYNAMIC_ENTRIES) {
            await cache.delete(keys[0]);
          }
        } catch {}
      }
    }
  } catch (e) {
    if (DEBUG) console.debug('safePut failed', e);
  }
}

function stampResponse(res) {
  try {
    const headers = new Headers(res.headers);
    headers.set('sw-fetched-at', String(Date.now()));
    return new Response(res.clone().body, {
      status: res.status,
      statusText: res.statusText,
      headers
    });
  } catch (e) {
    // Fallback: original Response zurückgeben, wenn Stempeln fehlschlägt
    return res;
  }
}

function isExpiredByTTL(res, ttlMs) {
  const h = res.headers?.get?.('sw-fetched-at');
  const ts = h ? Number(h) : 0;
  if (!ts || Number.isNaN(ts)) return true; // Alte Einträge ohne Stempel: als abgelaufen betrachten
  return (Date.now() - ts) > ttlMs;
}

// Strategien
async function networkFirst(req, cacheName = DYNAMIC_CACHE) {
  try {
    const fresh = await fetch(req);
    await safePut(cacheName, req, fresh);
    return fresh;
  } catch (_) {
    const cached = await caches.match(req);
    if (cached) return cached;
    if (req.mode === 'navigate' || req.headers.get('accept')?.includes('text/html')) {
      return caches.match('/offline.html');
    }
    throw _; // rethrow to surface if needed
  }
}

async function cacheFirst(req, cacheName = DYNAMIC_CACHE) {
  const cached = await caches.match(req);
  if (cached) return cached;
  const res = await fetch(req);
  await safePut(cacheName, req, res);
  return res;
}

async function staleWhileRevalidate(req, cacheName = DYNAMIC_CACHE) {
  const cached = await caches.match(req);
  const network = fetch(req).then(async (res) => {
    await safePut(cacheName, req, res);
    return res;
  }).catch(() => undefined);
  return cached || network || fetch(req);
}

// ------------------------------------------------------
// FETCH-HANDLER
// ------------------------------------------------------
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Nur GET-Requests cachen/abfangen
  if (req.method !== 'GET') return;

  const url = req.url;
  if (url.startsWith('chrome-extension')) return;
  if (isAnalytics(url)) return; // Tracking nicht cachen
  if (req.headers.get('range')) return; // Range-Requests nicht abfangen

  const dest = req.destination; // '', 'document', 'style', 'script', 'image', 'font', 'manifest', ...

  // Navigationsanfragen: Network-first mit Offline-Fallback
  if (req.mode === 'navigate' || dest === 'document') {
    event.respondWith((async () => {
      // Navigation preload bevorzugen, falls verfügbar
      const preload = await event.preloadResponse;
      if (preload) {
        return preload;
      }
      return networkFirst(req);
    })());
    return;
  }

  // Sonstige HTML-Fetches (z. B. Teilseiten/Partials): Stale-while-revalidate in separatem Pages-Cache
  if (req.headers.get('accept')?.includes('text/html')) {
    event.respondWith(pagesStrategy(req));
    return;
  }

  // Gleich-Origin Assets: gezielte Strategien
  if (isSameOrigin(url)) {
    if (dest === 'style' || dest === 'script' || dest === 'worker') {
      event.respondWith(staleWhileRevalidate(req));
      return;
    }
    if (dest === 'image' || dest === 'font') {
      event.respondWith((async () => {
        try {
          return await cacheFirst(req);
        } catch (e) {
          // Offline-Placeholder nur für Bilder
          if (dest === 'image') {
            const ph = await caches.match(OFFLINE_IMAGE);
            if (ph) return ph;
          }
          return Response.error();
        }
      })());
      return;
    }
    if (dest === 'manifest') {
      event.respondWith(staleWhileRevalidate(req));
      return;
    }
  }

  // Fremd-Origin oder sonstiges: Netzwerk durchschleifen, ohne zu cachen
  event.respondWith(
    fetch(req).catch(async () => {
      // Bei Offline nur dann Offline-Seite liefern, wenn es um Navigation ging – hier nein
      const cached = await caches.match(req);
      return cached || Response.error();
    })
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

// Spezielle Strategie nur für Seiten-HTML mit TTL
async function pagesStrategy(req) {
  const cache = await caches.open(PAGES_CACHE);
  const cached = await cache.match(req);

  // Wenn ein (möglicherweise abgelaufener) Cache existiert, parallel aktualisieren
  const networkPromise = fetch(req).then(async (res) => {
    await safePut(PAGES_CACHE, req, res);
    return res;
  }).catch(() => undefined);

  if (cached) {
    // TTL prüfen: wenn abgelaufen, bevorzugt Netzwerk liefern, sonst Cache
    if (isExpiredByTTL(cached, PAGES_TTL_MS)) {
      const fresh = await networkPromise;
      return fresh || cached; // Offline: lieber alten Cache liefern
    }
    // Nicht abgelaufen: sofort Cache, Netzwerk aktualisiert im Hintergrund
    return cached;
  }

  // Kein Cache: versuche Netzwerk, sonst Offline-Seite als harte Fallback nur bei HTML sinnvoll
  const fresh = await networkPromise;
  return fresh || caches.match('/offline.html');
}