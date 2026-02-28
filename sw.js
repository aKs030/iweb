/**
 * Modern Service Worker with Runtime Caching
 * @version 2.0.0
 */

const VERSION = new URL(self.location).searchParams.get('v') || '1';
const CACHE = `app-v${VERSION}`;
const RUNTIME = `runtime-v${VERSION}`;

const PRECACHE = [
  '/',
  '/manifest.json',
  '/content/assets/img/earth/textures/earth_day.webp',
  '/content/assets/img/earth/textures/earth_night.webp',
];

const SKIP_HOSTS = [
  'cloudflareinsights.com',
  'googletagmanager.com',
  'google-analytics.com',
  'googleapis.com',
  'gstatic.com',
];

// Install: Precache critical assets
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

// Activate: Clean old caches
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== CACHE && k !== RUNTIME)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// Fetch: Smart caching strategies
self.addEventListener('fetch', (e) => {
  const { request } = e;
  const url = new URL(request.url);

  // Skip non-GET or external services
  if (
    request.method !== 'GET' ||
    !url.protocol.startsWith('http') ||
    SKIP_HOSTS.some((h) => url.hostname.includes(h))
  ) {
    return;
  }

  // API: Network first
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(networkFirst(request));
    return;
  }

  // Images & Fonts: Cache first
  if (['image', 'font'].includes(request.destination)) {
    e.respondWith(cacheFirst(request));
    return;
  }

  // Scripts & Styles: Stale while revalidate
  if (['script', 'style'].includes(request.destination)) {
    e.respondWith(staleRevalidate(request));
    return;
  }

  // Documents: Network first
  e.respondWith(networkFirst(request));
});

// Cache first with network fallback
const OFFLINE_HTML = `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Offline – Abdulkerim Sesli</title>
  <style>
    :root { color-scheme: dark; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #030303; color: #f5f5f5;
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh; margin: 0;
    }
    .card {
      text-align: center; max-width: 400px;
      padding: 2rem; border-radius: 12px;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
    }
    .icon { font-size: 3rem; margin-bottom: 1rem; }
    h1 { font-size: 1.5rem; margin: 0 0 0.75rem; }
    p { color: rgba(255,255,255,0.7); margin: 0 0 1.5rem; line-height: 1.6; }
    button {
      background: #098bff; color: #fff; border: none;
      padding: 0.75rem 1.5rem; border-radius: 8px;
      font-size: 1rem; cursor: pointer;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">📡</div>
    <h1>Keine Verbindung</h1>
    <p>Du bist derzeit offline. Bitte überprüfe deine Internetverbindung und versuche es erneut.</p>
    <button onclick="location.reload()">Erneut versuchen</button>
  </div>
</body>
</html>`;

async function cacheFirst(req) {
  const cache = await caches.open(RUNTIME);
  const cached = await cache.match(req);
  if (cached) return cached;

  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    // For document requests, return styled offline page
    if (req.destination === 'document') {
      return new Response(OFFLINE_HTML, {
        status: 503,
        headers: { 'Content-Type': 'text/html;charset=utf-8' },
      });
    }
    return new Response('Offline', { status: 503 });
  }
}

// Network first with cache fallback
async function networkFirst(req) {
  const cache = await caches.open(RUNTIME);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    const cached = await cache.match(req);
    if (cached) return cached;
    // Return styled offline page for document requests
    if (req.destination === 'document' || req.mode === 'navigate') {
      return new Response(OFFLINE_HTML, {
        status: 503,
        headers: { 'Content-Type': 'text/html;charset=utf-8' },
      });
    }
    return new Response('Offline', { status: 503 });
  }
}

// Stale while revalidate
async function staleRevalidate(req) {
  const cache = await caches.open(RUNTIME);
  const cached = await cache.match(req);

  const fetchPromise = fetch(req)
    .then((res) => {
      if (res.ok) cache.put(req, res.clone());
      return res;
    })
    .catch(() => cached || new Response('Offline', { status: 503 }));

  return cached || fetchPromise;
}
