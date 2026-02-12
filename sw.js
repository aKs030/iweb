/**
 * Service Worker for PWA
 * Provides offline support and caching strategies
 * @version 1.1.0
 */

// @ts-nocheck
/* global self, caches */

const CACHE_VERSION = 'v1.1.0';
const CACHE_NAME = `iweb-${CACHE_VERSION}`;

// Assets to cache on install
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/content/assets/img/icons/favicon.svg',
  // Critical earth textures for faster loading
  '/content/assets/img/earth/textures/earth_day.webp',
  '/content/assets/img/earth/textures/earth_night.webp',
  '/content/assets/img/earth/textures/earth_normal.webp',
  '/content/assets/img/earth/textures/earth_bump.webp',
];

// Cache strategies
const CACHE_STRATEGIES = {
  // Cache first, fallback to network
  CACHE_FIRST: 'cache-first',
  // Network first, fallback to cache
  NETWORK_FIRST: 'network-first',
  // Network only
  NETWORK_ONLY: 'network-only',
  // Cache only
  CACHE_ONLY: 'cache-only',
  // Stale while revalidate
  STALE_WHILE_REVALIDATE: 'stale-while-revalidate',
};

/**
 * Install event - precache assets
 */
self.addEventListener('install', (event) => {
  if (self.location.hostname === 'localhost') {
    console.log('[SW] Installing service worker...');
  }

  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        if (self.location.hostname === 'localhost') {
          console.log('[SW] Precaching assets');
        }
        return cache.addAll(PRECACHE_ASSETS);
      })
      .then(() => {
        if (self.location.hostname === 'localhost') {
          console.log('[SW] Installation complete');
        }
        return self.skipWaiting();
      })
      .catch((error) => {
        if (self.location.hostname === 'localhost') {
          console.error('[SW] Installation failed:', error);
        }
      }),
  );
});

/**
 * Activate event - cleanup old caches
 */
self.addEventListener('activate', (event) => {
  if (self.location.hostname === 'localhost') {
    console.log('[SW] Activating service worker...');
  }

  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              if (self.location.hostname === 'localhost') {
                console.log('[SW] Deleting old cache:', cacheName);
              }
              return caches.delete(cacheName);
            }
          }),
        );
      })
      .then(() => {
        if (self.location.hostname === 'localhost') {
          console.log('[SW] Activation complete');
        }
        return self.clients.claim();
      }),
  );
});

/**
 * Fetch event - handle requests with caching strategies
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome-extension and other protocols
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Skip Cloudflare analytics/insights - let it handle its own requests
  // cspell:ignore cloudflareinsights
  if (url.hostname === 'static.cloudflareinsights.com') {
    return;
  }

  // Skip external analytics and tracking scripts
  // cspell:ignore googletagmanager
  if (
    url.hostname.includes('googletagmanager.com') ||
    url.hostname.includes('google-analytics.com')
  ) {
    return;
  }

  // Skip Google Fonts - let the CDN handle caching directly
  if (
    url.hostname === 'fonts.googleapis.com' ||
    url.hostname === 'fonts.gstatic.com'
  ) {
    return;
  }

  // Determine strategy based on request type
  const strategy = getStrategy(url, request);

  event.respondWith(handleRequest(request, strategy));
});

/**
 * Get caching strategy for request
 * @param {URL} url - Request URL
 * @param {Request} request - Request object
 * @returns {string} Strategy name
 */
function getStrategy(url, request) {
  // API requests - network first
  if (url.pathname.startsWith('/api/')) {
    return CACHE_STRATEGIES.NETWORK_FIRST;
  }

  // Images - cache first
  if (request.destination === 'image') {
    return CACHE_STRATEGIES.CACHE_FIRST;
  }

  // Fonts - cache first
  if (request.destination === 'font') {
    return CACHE_STRATEGIES.CACHE_FIRST;
  }

  // Scripts and styles - stale while revalidate
  if (request.destination === 'script' || request.destination === 'style') {
    return CACHE_STRATEGIES.STALE_WHILE_REVALIDATE;
  }

  // Documents - network first
  if (request.destination === 'document') {
    return CACHE_STRATEGIES.NETWORK_FIRST;
  }

  // Default - network first
  return CACHE_STRATEGIES.NETWORK_FIRST;
}

/**
 * Handle request with specified strategy
 * @param {Request} request - Request object
 * @param {string} strategy - Strategy name
 * @returns {Promise<Response>}
 */
async function handleRequest(request, strategy) {
  switch (strategy) {
    case CACHE_STRATEGIES.CACHE_FIRST:
      return cacheFirst(request);
    case CACHE_STRATEGIES.NETWORK_FIRST:
      return networkFirst(request);
    case CACHE_STRATEGIES.STALE_WHILE_REVALIDATE:
      return staleWhileRevalidate(request);
    case CACHE_STRATEGIES.CACHE_ONLY:
      return cacheOnly(request);
    case CACHE_STRATEGIES.NETWORK_ONLY:
      return networkOnly(request);
    default:
      return networkFirst(request);
  }
}

/**
 * Cache first strategy
 */
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    if (self.location.hostname === 'localhost') {
      console.error('[SW] Cache first failed:', error);
    }
    return new Response('Offline', { status: 503 });
  }
}

/**
 * Network first strategy
 */
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    if (self.location.hostname === 'localhost') {
      console.error('[SW] Network first failed:', error);
    }
    return new Response('Offline', { status: 503 });
  }
}

/**
 * Stale while revalidate strategy
 */
async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);

  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        // Clone before any other operations
        const responseToCache = response.clone();
        caches
          .open(CACHE_NAME)
          .then((cache) => {
            cache.put(request, responseToCache);
          })
          .catch((error) => {
            if (self.location.hostname === 'localhost') {
              console.error('[SW] Cache put failed:', error);
            }
          });
      }
      return response;
    })
    .catch((error) => {
      if (self.location.hostname === 'localhost') {
        console.error('[SW] Stale while revalidate fetch failed:', error);
      }
      return cached || new Response('Offline', { status: 503 });
    });

  return cached || fetchPromise;
}

/**
 * Cache only strategy
 */
async function cacheOnly(request) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }
  return new Response('Not in cache', { status: 404 });
}

/**
 * Network only strategy
 */
async function networkOnly(request) {
  return fetch(request);
}

/**
 * Message event - handle messages from clients
 */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
