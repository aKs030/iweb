/**
 * Service Worker — Network-First with Offline Fallback
 * @version 3.0.0
 *
 * Strategie:
 * - Navigation (HTML): Immer Netzwerk, Cache nur als Offline-Fallback
 * - Statische Assets (JS/CSS/Fonts): Stale-While-Revalidate
 * - Bilder/Modelle: Cache-First (langlebig)
 * - API: Network-Only (kein Caching)
 * - Externe Hosts: Komplett ignoriert (kein Caching)
 *
 * Update-Flow:
 * 1. Browser prüft sw.js bei Navigation (max alle 24h, mit no-cache Header sofort)
 * 2. Byte-Vergleich: Nur wenn sich der Inhalt ändert → install-Event
 * 3. Neuer SW wartet im "waiting"-State bis Client SKIP_WAITING sendet
 * 4. Client zeigt Toast → User klickt → postMessage('SKIP_WAITING')
 * 5. Neuer SW aktiviert → clients.claim() → controllerchange → Seite lädt neu
 */

// ─── Cache-Name (wird NICHT versioniert — Aktivierung räumt alten Cache auf) ──
const CACHE_NAME = 'v1';

// ─── Hosts die komplett ignoriert werden (Analytics, CDNs etc.) ──────────────
const IGNORED_HOSTS = new Set([
  'cloudflareinsights.com',
  'googletagmanager.com',
  'google-analytics.com',
  'googleapis.com',
  'gstatic.com',
  'esm.sh',
  'cdn.jsdelivr.net',
  'unpkg.com',
]);

// ─── Offline-Fallback-Seite ──────────────────────────────────────────────────
const OFFLINE_PAGE = '/offline.html';

// ─── Install: Cache nur die Offline-Seite ────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.add(OFFLINE_PAGE)),
  );
  // Nicht skipWaiting() hier — der Client steuert das
});

// ─── Activate: Alte Caches löschen + sofort alle Tabs übernehmen ─────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// ─── Message: Client kann skipWaiting auslösen ──────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ─── Fetch: Routing nach Request-Typ ─────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Nur GET-Requests von HTTP(S)-Ursprüngen behandeln
  if (request.method !== 'GET' || !url.protocol.startsWith('http')) return;

  // Externe Hosts komplett ignorieren
  if (isIgnoredHost(url.hostname)) return;

  // API-Requests: Immer Netzwerk, kein Cache
  if (url.pathname.startsWith('/api/')) return;

  // Navigation (HTML-Seiten): Network-First mit Offline-Fallback
  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request));
    return;
  }

  // Bilder & 3D-Modelle: Cache-First
  if (
    request.destination === 'image' ||
    request.destination === 'font' ||
    url.pathname.endsWith('.glb') ||
    url.pathname.endsWith('.gltf')
  ) {
    event.respondWith(handleCacheFirst(request));
    return;
  }

  // JS, CSS: Stale-While-Revalidate
  if (request.destination === 'script' || request.destination === 'style') {
    event.respondWith(handleStaleWhileRevalidate(request));
    return;
  }

  // Alles andere: Network-First
  event.respondWith(handleNetworkFirst(request));
});

// ─── Helper: Host-Check ──────────────────────────────────────────────────────
function isIgnoredHost(hostname) {
  for (const host of IGNORED_HOSTS) {
    if (hostname.includes(host)) return true;
  }
  return false;
}

// ─── Strategie: Navigation — Network mit Offline-Fallback ────────────────────
async function handleNavigation(request) {
  try {
    const response = await fetch(request);
    // Erfolgreiche Antworten im Cache speichern für Offline-Zugriff
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Offline: Versuche gecachte Version der angeforderten Seite
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) return cached;

    // Letzte Option: Offline-Fallback-Seite
    const offlinePage = await cache.match(OFFLINE_PAGE);
    return (
      offlinePage ||
      new Response('Offline', {
        status: 503,
        headers: { 'Content-Type': 'text/plain' },
      })
    );
  }
}

// ─── Strategie: Cache-First (Bilder, Fonts, 3D-Modelle) ─────────────────────
async function handleCacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return new Response('', { status: 503 });
  }
}

// ─── Strategie: Network-First (Fallback auf Cache) ───────────────────────────
async function handleNetworkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    return cached || new Response('', { status: 503 });
  }
}

// ─── Strategie: Stale-While-Revalidate (JS, CSS) ────────────────────────────
async function handleStaleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  // Immer im Hintergrund aktualisieren
  const networkPromise = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);

  // Sofort aus Cache antworten wenn vorhanden, sonst auf Netzwerk warten
  if (cached) return cached;

  const response = await networkPromise;
  return response || new Response('', { status: 503 });
}
