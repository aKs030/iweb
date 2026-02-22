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
async function cacheFirst(req) {
  const cache = await caches.open(RUNTIME);
  const cached = await cache.match(req);
  if (cached) return cached;

  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch {
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
    return (await cache.match(req)) || new Response('Offline', { status: 503 });
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
