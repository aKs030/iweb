self.addEventListener('install', e => {
  e.waitUntil(caches.open('v1').then(cache => cache.addAll([
    '/', '/index.html', '/css/index.css', '/js/menu.js', '/offline.html'
  ])));
});
self.addEventListener('fetch', e => {
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request).then(r => r || caches.match('/offline.html')))
  );
});
