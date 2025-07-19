// idb-min.js – Minimal IndexedDB Helper für openDB
// Quelle: https://github.com/jakearchibald/idb (angepasst)

// Globale openDB-Funktion für Service Worker (ohne export)
self.openDB = function(name, version, opts = {}) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, version);
    request.onupgradeneeded = event => {
      if (opts.upgrade) opts.upgrade(request.result, event.oldVersion, event.newVersion, request.transaction);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};
