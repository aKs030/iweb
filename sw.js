const CACHE_NAME = 'iweb';
const ASSETS = [
  '/',
  '/index.html',
  '/css/index.css',
  '/css/_global.css',
  '/css/cookies.css',
  '/css/menu.css',
  '/css/footer.css',
  '/js/templateLoader.js',
  '/js/intext.js',
  '/js/menu.js',
  '/js/scroll-dots.js',
  '/js/cookie-system.js',
  '/img/touch-icon-180.png',
  '/img/favicon-32.png',
  '/img/favicon.ico',
  '/pages/komponente/menu.html',
  '/pages/komponente/footer.html',
  '/pages/index-card.html',
  '/manifest.json',
  '/offline.html',
  '/404.html'
];

// Cookie Consent Status im Service Worker
let cookieConsentStatus = null;

self.addEventListener('install', evt => {
  console.log('🍪 SW: Installing Cookie Banner v2.0 Support');
  evt.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(self.skipWaiting())
  );
});

self.addEventListener('activate', evt => {
  console.log('🍪 SW: Activating Cookie Banner v2.0 Support');
  evt.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys
        .filter(k => k !== CACHE_NAME)
        .map(k => caches.delete(k))
      )
    )
    .then(self.clients.claim())
  );
});

// Enhanced fetch handler mit Cookie-Consent-Awareness
self.addEventListener('fetch', evt => {
  const url = new URL(evt.request.url);
  
  // Blockiere Analytics-Requests wenn kein Consent
  if (shouldBlockRequest(url)) {
    evt.respondWith(new Response('', { status: 204 }));
    return;
  }
  
  evt.respondWith(
    caches.match(evt.request)
      .then(res => {
        if (res) return res;
        return fetch(evt.request)
          .then(networkRes => {
            if (networkRes.status === 404) {
              return caches.match('/404.html');
            }
            return networkRes;
          })
          .catch(() => {
            // Wenn Netzwerk und Cache fehlschlagen, zeige die 404.html
            return caches.match('/404.html');
          });
      })
      .catch(() => {
        // Offline Fallback für Cookie Banner
        // Fallback für Cookie Banner entfernt, da Datei nicht vorhanden
        // Offline Fallback für alle anderen Seiten
        return caches.match('/offline.html');
      })
  );
});

// Cookie Consent Message Handler
self.addEventListener('message', event => {
  // Sicherheitscheck: Nur Nachrichten von der eigenen Origin akzeptieren
  if (event.origin !== self.location.origin) {
    console.warn('SW: Message from unauthorized origin blocked:', event.origin);
    return;
  }
  
  if (event.data && event.data.type === 'COOKIE_CONSENT_UPDATE') {
    cookieConsentStatus = event.data.consent;
    console.log('🍪 SW: Cookie Consent updated:', cookieConsentStatus);
  }
});

function shouldBlockRequest(url) {
  if (!cookieConsentStatus) return false;
  
  // Blockiere Google Analytics wenn kein Analytics-Consent
  if (url.hostname.includes('google-analytics.com') || 
      url.hostname.includes('googletagmanager.com')) {
    return !cookieConsentStatus.analytics;
  }
  
  // Blockiere Social Media Tracker
  if (url.hostname.includes('facebook.com') || 
      url.hostname.includes('twitter.com') ||
      url.hostname.includes('linkedin.com')) {
    return !cookieConsentStatus.social;
  }
  
  return false;
}