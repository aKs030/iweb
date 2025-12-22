/**
 * Service Worker für Progressive Web App
 *
 * Features:
 * - Offline-First Strategie für statische Assets
 * - Network-First für API/dynamische Inhalte
 * - Cache-First für Bilder und Fonts
 * - Automatische Cache-Bereinigung
 *
 * @version 1.0.0
 * @date 2025-12-04
 */

const CACHE_VERSION = 'iweb-v1.0.0'
const STATIC_CACHE = `${CACHE_VERSION}-static`
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`
const IMAGE_CACHE = `${CACHE_VERSION}-images`

// Statische Assets die sofort gecacht werden sollen
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/content/styles/root.css',
  '/content/styles/main.css',
  '/content/main.js',
  '/content/utils/shared-utilities.js',
  '/content/components/menu/menu.js',
  '/content/components/menu/menu.css',
  '/content/components/footer/footer-complete.js',
  '/content/components/footer/footer.css',
  '/content/components/head/head-complete.js',
  '/content/utils/accessibility-manager.js',
  '/pages/home/hero.css',
  '/pages/home/hero-manager.js',
  '/pages/gallery/gallery.html',
  '/pages/gallery/gallery-styles.css',
  '/pages/gallery/gallery-app.js',
  '/content/components/typewriter/typewriter.css',
  '/content/components/typewriter/TypeWriter.js'
]

// Cache-Größenlimits
const CACHE_LIMITS = {
  [DYNAMIC_CACHE]: 50,
  [IMAGE_CACHE]: 100
}

// Installation - Cache statische Assets
self.addEventListener('install', event => {
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(STATIC_CACHE)
        // Use robust per-asset fetching: addAll will fail entirely if one resource is not fetchable.
        for (const asset of STATIC_ASSETS) {
          try {
            const req = new Request(asset, {mode: 'same-origin'})
            const res = await fetch(req)
            if (res && res.ok) {
              await cache.put(req, res.clone())
            } else {
              console.warn('[SW] Asset fetch failed:', asset, res && res.status)
            }
          } catch (e) {
            console.warn('[SW] Asset fetch exception:', asset, e)
          }
        }
        await self.skipWaiting()
      } catch (err) {
        // Fehler beim Cachen nicht blockieren
        console.error('[SW] Installation failed:', err)
      }
    })()
  )
})

// Aktivierung - Bereinige alte Caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            // Lösche alle Caches die nicht zur aktuellen Version gehören
            if (cacheName.startsWith('iweb-') && !cacheName.startsWith(CACHE_VERSION)) {
              return caches.delete(cacheName)
            }
          })
        )
      })
      .then(() => {
        return self.clients.claim()
      })
  )
})

// Fetch - Intelligente Caching-Strategien
self.addEventListener('fetch', event => {
  const {request} = event
  const url = new URL(request.url)

  // Ignoriere Chrome Extension Requests
  if (url.protocol === 'chrome-extension:') return

  // Ignoriere Cross-Origin Requests (außer Schriftarten/Bilder)
  if (url.origin !== location.origin) {
    if (!request.destination.match(/font|image|style/)) {
      return
    }
  }

  event.respondWith(handleFetch(request))
})

/**
 * Haupt-Fetch-Handler mit verschiedenen Strategien
 */
async function handleFetch(request) {
  const url = new URL(request.url)

  // Bilder: Cache-First mit Fallback
  if (request.destination === 'image') {
    return cacheFirst(request, IMAGE_CACHE)
  }

  // Schriftarten: Cache-First
  if (request.destination === 'font' || url.pathname.match(/\.(woff2?|ttf|otf)$/i)) {
    return cacheFirst(request, STATIC_CACHE)
  }

  // CSS/JS: Stale-While-Revalidate
  if (request.destination === 'script' || request.destination === 'style') {
    return staleWhileRevalidate(request, STATIC_CACHE)
  }

  // HTML: Network-First mit Cache-Fallback
  if (request.destination === 'document' || url.pathname.endsWith('.html')) {
    return networkFirst(request, DYNAMIC_CACHE)
  }

  // API-Calls: Network-Only
  if (url.pathname.startsWith('/api/')) {
    return fetch(request)
  }

  // Default: Network-First
  return networkFirst(request, DYNAMIC_CACHE)
}

/**
 * Cache-First Strategie: Cache zuerst, dann Network
 */
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request)
  if (cached) {
    return cached
  }

  try {
    const response = await fetch(request)
    if (response && response.status === 200) {
      const cache = await caches.open(cacheName)
      cache.put(request, response.clone())
      limitCacheSize(cacheName, CACHE_LIMITS[cacheName])
    }
    return response
  } catch {
    // Network failed, return cached offline page if available
    return caches.match('/offline.html') || new Response('Offline', {status: 503})
  }
}

/**
 * Network-First Strategie: Network zuerst, dann Cache
 */
async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request)
    if (response && response.status === 200) {
      const cache = await caches.open(cacheName)
      cache.put(request, response.clone())
      limitCacheSize(cacheName, CACHE_LIMITS[cacheName])
    }
    return response
  } catch (error) {
    const cached = await caches.match(request)
    if (cached) {
      return cached
    }
    // Fallback für HTML-Seiten
    if (request.destination === 'document') {
      return caches.match('/offline.html') || new Response('Offline', {status: 503})
    }
    throw error
  }
}

/**
 * Stale-While-Revalidate: Cache sofort zurückgeben, im Hintergrund aktualisieren
 */
async function staleWhileRevalidate(request, cacheName) {
  const cached = await caches.match(request)

  const fetchPromise = (async () => {
    try {
      const response = await fetch(request)
      if (response && response.status === 200) {
        // Clone synchronously before any awaits that could consume the body
        const responseForCache = response.clone()
        const cache = await caches.open(cacheName)
        await cache.put(request, responseForCache)
        limitCacheSize(cacheName, CACHE_LIMITS[cacheName])
      }
      return response
    } catch (e) {
      return cached
    }
  })()

  return cached || fetchPromise
}

/**
 * Limitiere Cache-Größe durch Löschen ältester Einträge
 */
async function limitCacheSize(cacheName, maxItems) {
  if (!maxItems) return

  const cache = await caches.open(cacheName)
  const keys = await cache.keys()

  if (keys.length > maxItems) {
    // Lösche die ersten (ältesten) Einträge
    const deleteCount = keys.length - maxItems
    for (let i = 0; i < deleteCount; i++) {
      await cache.delete(keys[i])
    }
  }
}

/**
 * Message Handler für Kommunikation mit der App
 */
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }

  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then(cacheNames => {
        return Promise.all(cacheNames.map(cacheName => caches.delete(cacheName)))
      })
    )
  }
})
