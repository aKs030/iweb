// ===========================
// iweb Service Worker v3.0
// ===========================

// Konfiguration
const DEBUG = /localhost|127\.0\.0\.1/.test(self.location.hostname);
const STATIC_CACHE = 'iweb-static-v3';
const DYNAMIC_CACHE = 'iweb-dynamic-v3';

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
  '/content/img/icons/icon-192.png'
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
      await Promise.all(
        STATIC_ASSETS.map(async (url) => {
          try {
            await cache.add(url);
          } catch (err) {
            warn('Skip caching (missing?):', url, err && err.message);
          }
        })
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
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => (key.startsWith('iweb-')) && key !== STATIC_CACHE && key !== DYNAMIC_CACHE)
          .map((oldKey) => {
            log('Deleting old cache:', oldKey);
            return caches.delete(oldKey);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// Strategien
async function networkFirst(req) {
  try {
    const fresh = await fetch(req);
    const cache = await caches.open(DYNAMIC_CACHE);
    cache.put(req, fresh.clone());
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

async function cacheFirst(req) {
  const cached = await caches.match(req);
  if (cached) return cached;
  const res = await fetch(req);
  const cache = await caches.open(DYNAMIC_CACHE);
  cache.put(req, res.clone());
  return res;
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(DYNAMIC_CACHE);
  const cached = await caches.match(req);
  const network = fetch(req).then((res) => {
    cache.put(req, res.clone());
    return res;
  }).catch(() => undefined);
  return cached || network || fetch(req);
}

function isAnalytics(url) {
  return /google-analytics\.com|googletagmanager\.com|gtag\/js/.test(url);
}

function isSameOrigin(url) {
  try { return new URL(url).origin === self.location.origin; } catch { return false; }
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

  const dest = req.destination; // '', 'document', 'style', 'script', 'image', 'font', 'manifest', ...

  // Navigationsanfragen: Network-first mit Offline-Fallback
  if (req.mode === 'navigate' || dest === 'document' || req.headers.get('accept')?.includes('text/html')) {
    event.respondWith(networkFirst(req));
    return;
  }

  // Gleich-Origin Assets: gezielte Strategien
  if (isSameOrigin(url)) {
    if (dest === 'style' || dest === 'script' || dest === 'worker') {
      event.respondWith(staleWhileRevalidate(req));
      return;
    }
    if (dest === 'image' || dest === 'font') {
      event.respondWith(cacheFirst(req));
      return;
    }
    if (dest === 'manifest') {
      event.respondWith(staleWhileRevalidate(req));
      return;
    }
  }

  // Fallback: Versuche Netzwerk, dann Cache
  event.respondWith(
    fetch(req).then((res) => {
      const clone = res.clone();
      caches.open(DYNAMIC_CACHE).then((c) => c.put(req, clone));
      return res;
    }).catch(async () => {
      const cached = await caches.match(req);
      return cached || caches.match('/offline.html');
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