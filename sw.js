/**

// Helper Functions

function getStrategy(request) {
  const url = request.url;
  
  for (const [strategy, patterns] of Object.entries(CACHE_STRATEGIES)) {
    if (patterns.some(pattern => pattern.test(url))) {
      return strategy;
    }
  }
  
  return 'networkFirst';
}

// Network First Strategy
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.error('[ServiceWorker] networkFirst Fehler:', error);
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    if (request.mode === 'navigate') {
      const offlineResponse = await caches.match(OFFLINE_URL);
      if (offlineResponse) {
        return offlineResponse;
      }
    }
    // Gib eine generische Response zurück, statt Fehler zu werfen
    return new Response('Offline und keine passende Ressource im Cache.', {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}

// Cache First Strategy
async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.error('[ServiceWorker] Fetch failed:', error);
    throw error;
  }
}

// Stale While Revalidate Strategy
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);
  
  const fetchPromise = fetch(request)
    .then(networkResponse => {
      if (networkResponse.ok) {
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    })
    .catch(error => {
      console.warn('[ServiceWorker] Revalidation failed:', error);
      return cachedResponse;
    });
  
  return cachedResponse || fetchPromise;
}

// Message Event - Handle messages from clients
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[ServiceWorker] Skip waiting requested');
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_VERSION });
  }
});

// Background Sync (if needed in future)
self.addEventListener('sync', event => {
  if (event.tag === 'sync-data') {
    console.log('[ServiceWorker] Syncing data...');
    // Implement sync logic here
  }
});

// Push Notifications (if needed in future)
self.addEventListener('push', event => {
  if (event.data) {
    const data = event.data.json();
    console.log('[ServiceWorker] Push received:', data);
    
    const options = {
      body: data.body,
      icon: '/img/icon-192.png',
      badge: '/img/badge-72.png',
      vibrate: [100, 50, 100],
      data: {
        dateOfArrival: Date.now(),
        primaryKey: 1
      }
    };
    
    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  }
});
self.importScripts('js/idb-min.js');
// Sync-Event für das Kontaktformular
self.addEventListener('sync', async event => {
  if (event.tag === 'contact-form') {
    event.waitUntil(
      sendPendingFormData()
    );
  }
});

// Funktion zum Senden der ausstehenden Formulardaten
async function sendPendingFormData() {
  // openDB muss verfügbar sein (z.B. via idb-Bibliothek)
  const db = await openDB('formData', 1);
  const tx = db.transaction('pending', 'readonly');
  const pendingData = await tx.objectStore('pending').getAll();
  
  for (const data of pendingData) {
    try {
      await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      // Erfolgreich gesendet - aus DB löschen
      await db.delete('pending', data.id);
    } catch (error) {
      console.error('Sync failed:', error);
    }
  }
}
/**
 * Service Worker für iweb-7 - Optimized Version
 * Version: 3.0.0
 * Optimierte Cache-Strategie mit Offline-Support
 */

const CACHE_VERSION = 'v3.0.0';
const CACHE_NAME = `iweb7-${CACHE_VERSION}`;
const OFFLINE_URL = '/pages/komponente/offline.html';

// Assets die immer gecached werden sollen
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/pages/komponente/offline.html',
  '/pages/komponente/404.html',
  '/css/_global.css',
  '/css/index.css',
  '/css/menu.css',
  '/js/main-init.js',
  '/js/menu.js',
  '/manifest.json',
  '/img/favicon.ico',
  '/img/favicon-32.png',
  '/img/touch-icon-180.png'
];

// Cache-Strategien für verschiedene Ressourcen-Typen
const CACHE_STRATEGIES = {
  // Network First - für HTML und API calls
  networkFirst: [
    /\.html$/,
    /\/api\//,
    /\/pages\//
  ],
  
  // Cache First - für Assets
  cacheFirst: [
    /\.css$/,
    /\.js$/,
    /\.woff2?$/,
    /\.ttf$/,
    /\.otf$/
  ],
  
  // Stale While Revalidate - für Bilder
  staleWhileRevalidate: [
    /\.jpg$/,
    /\.jpeg$/,
    /\.png$/,
    /\.gif$/,
    /\.webp$/,
    /\.svg$/,
    /\.ico$/
  ]
};

// Cookie Consent Status
let cookieConsentStatus = null;

// Install Event
self.addEventListener('install', event => {
  console.log('[ServiceWorker] Installing version:', CACHE_VERSION);
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[ServiceWorker] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
      .catch(error => {
        console.error('[ServiceWorker] Installation failed:', error);
      })
  );
});

// Activate Event
self.addEventListener('activate', event => {
  console.log('[ServiceWorker] Activating version:', CACHE_VERSION);
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(cacheName => cacheName.startsWith('iweb7-') && cacheName !== CACHE_NAME)
            .map(cacheName => {
              console.log('[ServiceWorker] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch Event
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-HTTP(S) requests
  if (!url.protocol.startsWith('http')) return;
  
  // Skip cross-origin requests
  if (url.origin !== self.location.origin) {
    // Blockiere Analytics wenn kein Consent
    if (shouldBlockRequest(url)) {
      event.respondWith(new Response('', { status: 204 }));
      return;
    }
    return;
  }
  
  // Determine cache strategy
  const strategy = getStrategy(request);
  
  switch (strategy) {
    case 'networkFirst':
      event.respondWith(networkFirst(request));
      break;
    case 'cacheFirst':
      event.respondWith(cacheFirst(request));
      break;
    case 'staleWhileRevalidate':
      event.respondWith(staleWhileRevalidate(request));
      break;
    default:
      event.respondWith(networkFirst(request));
  }
});

// Message Event - Cookie Consent Updates
self.addEventListener('message', event => {
  // Sicherheitscheck
  if (event.origin !== self.location.origin) {
    console.warn('[ServiceWorker] Message from unauthorized origin blocked');
    return;
  }

  if (event.data && event.data.type === 'COOKIE_CONSENT_UPDATE') {
    cookieConsentStatus = event.data.consent;
    console.log('[ServiceWorker] Cookie consent updated:', cookieConsentStatus);
  }
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Helper Functions

function getStrategy(request) {
  const url = request.url;
  
  for (const [strategy, patterns] of Object.entries(CACHE_STRATEGIES)) {
    if (patterns.some(pattern => pattern.test(url))) {
      return strategy;
    }
  }
  
  return 'networkFirst';
}

// Network First Strategy
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      return caches.match(OFFLINE_URL);
    }
    
    // Return 404 page
    return caches.match('/pages/komponente/404.html');
  }
}

// Cache First Strategy
async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.error('[ServiceWorker] Fetch failed:', error);
    throw error;
  }
}

// Stale While Revalidate Strategy
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);
  
  const fetchPromise = fetch(request)
    .then(networkResponse => {
      if (networkResponse.ok) {
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    })
    .catch(error => {
      console.warn('[ServiceWorker] Revalidation failed:', error);
      return cachedResponse;
    });
  
  return cachedResponse || fetchPromise;
}

// Check if request should be blocked based on cookie consent
function shouldBlockRequest(url) {
  if (!cookieConsentStatus) return false;

  // Block Google Analytics if no analytics consent
  if (
    url.hostname.includes('google-analytics.com') ||
    url.hostname.includes('googletagmanager.com')
  ) {
    return !cookieConsentStatus.analytics;
  }

  // Block social media trackers if no social consent
  if (
    url.hostname.includes('facebook.com') ||
    url.hostname.includes('twitter.com') ||
    url.hostname.includes('linkedin.com')
  ) {
    return !cookieConsentStatus.social;
  }

  return false;
}