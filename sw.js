const CACHE_NAME = 'iweb5-cookie-v2.0';
const ASSETS = [
  '/',
  '/index.html',
  '/css/index.css',
  '/css/_global.css',
  '/css/cookie-banner.css',
  '/js/templateLoader.js',
  '/js/intext.js',
  '/js/menu.js',
  '/js/scroll-dots.js',
  '/js/cookie-banner-v2.js',
  '/img/touch-icon-180.png',
  '/cookie-banner-test.html',
  // …weitere wichtige Assets
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
      .then(res => res || fetch(evt.request))
      .catch(() => {
        // Offline Fallback für Cookie Banner
        if (evt.request.url.includes('cookie-banner')) {
          return caches.match('/cookie-banner-test.html');
        }
        return new Response('Offline', { status: 503 });
      })
  );
});

// Cookie Consent Message Handler
self.addEventListener('message', event => {
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