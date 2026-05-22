/// <reference lib="webworker" />

const LEGACY_CACHE_PREFIXES = ["iweb-static-", "static-v"];

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter(key => LEGACY_CACHE_PREFIXES.some(prefix => key.startsWith(prefix)))
          .map(key => caches.delete(key))
      );
      await self.registration.unregister();
    })()
  );
});
