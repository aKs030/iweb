/**
 * Tombstone Service Worker (Decommission)
 *
 * Zweck: Falls noch irgendein Client versucht, diesen Service Worker zu
 * installieren, wird er sich sofort selbst entfernen und alle Caches löschen.
 * Nach der nächsten Veröffentlichung kann diese Datei endgültig entfernt werden.
 */

self.addEventListener('install', (event) => {
  // Keine Assets cachen – sofort aktiv werden
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Sämtliche Caches löschen (defensiv – nicht nur iweb-*)
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    } catch {}

    // Sich selbst deregistrieren
    try { await self.registration.unregister(); } catch {}

    // Alle Clients neu laden, damit sie ohne SW laufen
    try {
      const clients = await self.clients.matchAll({ type: 'window' });
      for (const client of clients) {
        client.navigate(client.url);
      }
    } catch {}
  })());
});

// Keine fetch-Handler – alles läuft direkt übers Netz