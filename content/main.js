/**
 * Main Application Entry Point - Optimized
 * * OPTIMIZATIONS v4.1 (Performance):
 * - Fine-tuned ThreeEarthLoader init
 * - Ensure proper cleanup references
 * * @version 4.1.0
 * @last-modified 2025-11-29
 */

import {initHeroFeatureBundle} from '../pages/home/hero-manager.js'
import {
  createLazyLoadObserver,
  createLogger,
  EVENTS,
  fetchWithTimeout,
  fire,
  getElementById,
  schedulePersistentStorageRequest,
  SectionTracker
} from './utils/shared-utilities.js'
import {initHeroSubtitle} from './components/typewriter/TypeWriter.js'
import {a11y} from './utils/accessibility-manager.js'
// Ensure the a11y manager is available globally and initialized centrally
if (typeof window !== 'undefined') {
  try {
    window.a11y = a11y
    if (typeof a11y?.init === 'function') a11y.init()
  } catch (e) {
    /* ignored */
  }
}
import './components/menu/menu.js'

const log = createLogger('main')

// ===== Configuration & Environment =====
const ENV = {
  isTest:
    new URLSearchParams(window.location.search).has('test') ||
    navigator.userAgent.includes('HeadlessChrome') ||
    (window.location.hostname === 'localhost' && window.navigator.webdriver),
  debug: new URLSearchParams(window.location.search).has('debug'),
  // Disable Service Worker by default to avoid registration errors in unsupported contexts.
  // Enable with `?use-sw=1` in the URL if you want to opt-in.
  useServiceWorker: new URLSearchParams(window.location.search).has('use-sw')
}

// ===== Performance Tracking =====
const perfMarks = {
  start: performance.now(),
  domReady: 0,
  modulesReady: 0,
  windowLoaded: 0
}

// ===== Accessibility Announcements =====
const announce = (() => {
  const cache = new Map()

  return (message, {assertive = false, dedupe = false} = {}) => {
    if (!message) return

    if (dedupe && cache.has(message)) return
    if (dedupe) {
      cache.set(message, true)
      setTimeout(() => cache.delete(message), 3000)
    }

    try {
      const id = assertive ? 'live-region-assertive' : 'live-region-status'
      const region = getElementById(id)
      if (!region) return

      region.textContent = ''
      requestAnimationFrame(() => {
        region.textContent = message
      })
    } catch (error) {
      log.debug('Announcement failed:', error)
    }
  }
})()

// Export for other modules if needed, but avoid window global if possible.
// Legacy support for inline scripts or external dependencies:
window.announce = announce

// ===== Section Tracker =====
const sectionTracker = new SectionTracker()
sectionTracker.init()
// Kept for debugging/external access if strictly needed, but marked for review
if (ENV.debug) window.sectionTracker = sectionTracker

// ===== Section Loader =====
const SectionLoader = (() => {
  // Check if already initialized to prevent double execution
  if (window.SectionLoader) return window.SectionLoader

  const SELECTOR = 'section[data-section-src]'
  const loadedSections = new WeakSet()
  const retryAttempts = new WeakMap()
  const MAX_RETRIES = 2

  function dispatchEvent(type, section, detail = {}) {
    try {
      document.dispatchEvent(
        new CustomEvent(type, {
          detail: {id: section?.id, section, ...detail}
        })
      )
    } catch (error) {
      log.debug(`Event dispatch failed: ${type}`, error)
    }
  }

  // getSectionName inlined into loadSection; removed to avoid small helper function proliferation

  async function loadSection(section) {
    if (loadedSections.has(section)) return

    const url = section.getAttribute('data-section-src')
    if (!url) {
      section.removeAttribute('aria-busy')
      return
    }

    loadedSections.add(section)
    // Inline getSectionName: avoid small helper function footprint
    const sectionName = (() => {
      const labelId = section.getAttribute('aria-labelledby')
      if (labelId) {
        const label = getElementById(labelId)
        const text = label?.textContent?.trim()
        if (text) return text
      }
      return section.id || 'Abschnitt'
    })()
    const attempts = retryAttempts.get(section) || 0

    section.setAttribute('aria-busy', 'true')
    section.dataset.state = 'loading'

    announce(`Lade ${sectionName}…`, {dedupe: true})
    dispatchEvent('section:will-load', section, {url})

    try {
      // Try extensionless URL first to avoid server redirects (some hosts redirect .html -> no-ext)
      let response
      const isLocal = location.hostname === 'localhost' || location.hostname.startsWith('127.') || location.hostname.endsWith('.local')
      const fetchCandidates = isLocal
        ? [url, url && url.endsWith('.html') ? url : url + '.html']
        : [url && url.endsWith('.html') ? url.replace(/\.html$/, '') : url, url]

      for (const candidate of fetchCandidates) {
        try {
          response = await fetchWithTimeout(candidate)
          if (response && response.ok) break
        } catch (e) {
          response = null
        }
      }

      if (!response || !response.ok) {
        throw new Error(`HTTP ${response ? response.status : 'NO_RESPONSE'}: ${response ? response.statusText : 'no response'}`)
      }

      const html = await response.text()
      section.insertAdjacentHTML('beforeend', html)

      const template = section.querySelector('template')
      if (template) {
        section.appendChild(template.content.cloneNode(true))
      }

      section.querySelectorAll('.section-skeleton').forEach(el => el.remove())

      section.dataset.state = 'loaded'
      section.removeAttribute('aria-busy')

      announce(`${sectionName} geladen`, {dedupe: true})
      dispatchEvent('section:loaded', section, {state: 'loaded'})

      if (section.id === 'hero') {
        fire(EVENTS.HERO_LOADED)
      }
    } catch (error) {
      log.warn(`Section load failed: ${sectionName}`, error)

      const isTransient = /5\d\d/.test(String(error)) || !navigator.onLine
      const shouldRetry = isTransient && attempts < MAX_RETRIES

      if (shouldRetry) {
        retryAttempts.set(section, attempts + 1)
        loadedSections.delete(section)

        const delay = 300 * Math.pow(2, attempts)
        await new Promise(resolve => setTimeout(resolve, delay))

        return loadSection(section)
      }

      section.dataset.state = 'error'
      section.removeAttribute('aria-busy')

      announce(`Fehler beim Laden von ${sectionName}`, {assertive: true})
      dispatchEvent('section:error', section, {state: 'error'})

      // Inline injectRetryUI: inject a small retry UI directly
      if (!section.querySelector('.section-retry')) {
        const button = document.createElement('button')
        button.type = 'button'
        button.className = 'section-retry'
        button.textContent = 'Erneut laden'
        button.addEventListener('click', () => retrySection(section), {once: true})

        const wrapper = document.createElement('div')
        wrapper.className = 'section-error-box'
        wrapper.appendChild(button)
        section.appendChild(wrapper)
      }
    }
  }

  // injectRetryUI removed; kept inline in loadSection() to avoid small helper function

  async function retrySection(section) {
    section.querySelectorAll('.section-error-box').forEach(el => el.remove())
    section.dataset.state = ''
    loadedSections.delete(section)
    retryAttempts.delete(section)
    await loadSection(section)
  }

  function init() {
    if (init._initialized) return
    init._initialized = true

    const sections = Array.from(document.querySelectorAll(SELECTOR))
    const eagerSections = []
    const lazySections = []

    sections.forEach(section => {
      if (section.hasAttribute('data-eager')) {
        eagerSections.push(section)
      } else {
        lazySections.push(section)
      }
    })

    eagerSections.forEach(loadSection)

    if (lazySections.length) {
      const observer = createLazyLoadObserver(loadSection)
      lazySections.forEach(section => observer.observe(section))
    }
  }

  function reinit() {
    init._initialized = false
    init()
  }

  const api = {init, reinit, loadSection, retrySection}
  // Export to window for compatibility with inline handlers if any, but prefer ES import
  window.SectionLoader = api
  return api
})()

function _initApp() {
  SectionLoader.init()
  // Ensure accessibility preferences applied right away
  try {
    a11y?.updateAnimations?.()
    a11y?.updateContrast?.()
  } catch (e) {
    /* ignored */
  }
}

if (document.readyState !== 'loading') {
  _initApp()
} else {
  document.addEventListener(EVENTS.DOM_READY, _initApp, {once: true})
}

// ===== Scroll Snapping =====
const ScrollSnapping = (() => {
  let snapTimer = null
  const snapContainer = document.querySelector('.snap-container') || document.documentElement

  const disableSnap = () => snapContainer.classList.add('no-snap')
  const enableSnap = () => snapContainer.classList.remove('no-snap')

  function handleScroll() {
    disableSnap()
    clearTimeout(snapTimer)
    snapTimer = setTimeout(enableSnap, 180)
  }

  function handleKey(event) {
    const scrollKeys = ['PageDown', 'PageUp', 'Home', 'End', 'ArrowDown', 'ArrowUp', 'Space']
    if (scrollKeys.includes(event.key)) {
      handleScroll()
    }
  }

  function init() {
    window.addEventListener('wheel', handleScroll, {passive: true})
    window.addEventListener('touchmove', handleScroll, {passive: true})
    window.addEventListener('keydown', handleKey, {passive: true})
  }

  return {init}
})()

ScrollSnapping.init()

// ===== Loading Screen Manager =====
const LoadingScreenManager = (() => {
  const MIN_DISPLAY_TIME = 600
  let startTime = 0

  function hide() {
    const loadingScreen = getElementById('loadingScreen')
    if (!loadingScreen) return

    const elapsed = performance.now() - startTime
    const delay = Math.max(0, MIN_DISPLAY_TIME - elapsed)

    setTimeout(() => {
      loadingScreen.classList.add('hide')
      loadingScreen.setAttribute('aria-hidden', 'true')

      Object.assign(loadingScreen.style, {
        opacity: '0',
        pointerEvents: 'none',
        visibility: 'hidden'
      })

      const cleanup = () => {
        loadingScreen.style.display = 'none'
        loadingScreen.removeEventListener('transitionend', cleanup)
      }

      loadingScreen.addEventListener('transitionend', cleanup)
      setTimeout(cleanup, 700)

      announce('Anwendung geladen', {dedupe: true})

      try {
        document.body.classList.remove('global-loading-visible')
      } catch (e) {
        /* ignore */
      }

      perfMarks.loadingHidden = performance.now()
      log.info(`Loading screen hidden after ${Math.round(elapsed)}ms`)
    }, delay)
  }

  function init() {
    startTime = performance.now()
  }

  return {init, hide}
})()

// ===== Three.js Earth System Loader =====
const ThreeEarthLoader = (() => {
  let cleanupFn = null
  let isLoading = false

  async function load() {
    if (isLoading || cleanupFn) return

    // Explicitly check env for testing to skip heavy WebGL
    // ALLOW for specific verification script if requested via global override
    if (ENV.isTest && !window.__FORCE_THREE_EARTH) {
      log.info('Test environment detected - skipping Three.js Earth system for performance')
      return
    }

    const container = getElementById('threeEarthContainer')
    if (!container) {
      log.debug('Earth container not found')
      return
    }

    isLoading = true

    try {
      log.info('Loading Three.js Earth system...')
      const module = await import('./components/particles/three-earth-system.js')
      const ThreeEarthManager = module.default

      cleanupFn = await ThreeEarthManager.initThreeEarth()

      if (typeof cleanupFn === 'function') {
        // We only expose cleanup to window if absolutely needed for debugging
        if (ENV.debug) window.__threeEarthCleanup = cleanupFn

        log.info('Three.js Earth system initialized')
        perfMarks.threeJsLoaded = performance.now()
      }
    } catch (error) {
      log.warn('Three.js failed, using CSS fallback:', error)
    } finally {
      isLoading = false
    }
  }

  function init() {
    const container = getElementById('threeEarthContainer')
    if (!container) return

    const observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            observer.disconnect()
            load()
          }
        }
      },
      {rootMargin: '300px', threshold: 0.01}
    )

    observer.observe(container)
  }

  function initDelayed() {
    if (window.requestIdleCallback) {
      requestIdleCallback(init, {timeout: 2000})
    } else {
      setTimeout(init, 1000)
    }
  }

  return {initDelayed}
})()

// ===== Application Bootstrap =====
document.addEventListener(
  'DOMContentLoaded',
  async () => {
    perfMarks.domReady = performance.now()
    LoadingScreenManager.init()

    fire(EVENTS.DOM_READY)

    // Simplified TypeWriter Export
    window.initHeroSubtitle = initHeroSubtitle

    let modulesReady = false
    let windowLoaded = false

    const checkReady = () => {
      if (!modulesReady || !windowLoaded) return
      LoadingScreenManager.hide()
    }

    window.addEventListener(
      'load',
      () => {
        perfMarks.windowLoaded = performance.now()
        windowLoaded = true
        checkReady()
      },
      {once: true}
    )

    fire(EVENTS.CORE_INITIALIZED)

    fire(EVENTS.HERO_INIT_READY)
    initHeroFeatureBundle()

    ThreeEarthLoader.initDelayed()

    modulesReady = true
    perfMarks.modulesReady = performance.now()
    fire(EVENTS.MODULES_READY)
    checkReady()
    ;(function scheduleSmartForceHide(attempt = 1) {
      const INITIAL_DELAY = 5000
      const RETRY_DELAY = 5000
      const MAX_ATTEMPTS = 3

      setTimeout(
        () => {
          if (windowLoaded) return

          // If other modules registered as blocking, defer forced hide and retry
          try {
            if (AppLoadManager && typeof AppLoadManager.isBlocked === 'function' && AppLoadManager.isBlocked()) {
              log.warn(
                `Deferring forced loading screen hide (attempt ${attempt}): blocking modules=${AppLoadManager.getPending().join(', ')}`
              )

              if (attempt < MAX_ATTEMPTS) {
                scheduleSmartForceHide(attempt + 1)
                return
              }
              log.warn('Max attempts reached - forcing hide despite blocking modules')
            }
          } catch (e) {
            log.debug('AppLoadManager check failed:', e)
          }

          log.warn('Forcing loading screen hide after timeout')
          // Force-hide now
          LoadingScreenManager.hide()
        },
        attempt === 1 ? INITIAL_DELAY : RETRY_DELAY
      )
    })()

    schedulePersistentStorageRequest(2200)

    // Activate deferred styles that were marked with data-defer="1"
    const activateDeferredStyles = () => {
      try {
        const links = document.querySelectorAll('link[rel="stylesheet"][data-defer="1"]')
        links.forEach(link => {
          try {
            link.media = 'all'
            link.removeAttribute('data-defer')
          } catch (e) {
            /* ignore individual link errors */
          }
        })
      } catch (e) {
        /* ignore */
      }
    }

    try {
      // Try activating now (covers case where links are already in DOM)
      activateDeferredStyles()

      // Ensure activation after DOM is parsed and on full load
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', activateDeferredStyles, {once: true})
      } else {
        // In case script executed after parsing, ensure microtask activation
        setTimeout(activateDeferredStyles, 0)
      }
      window.addEventListener('load', activateDeferredStyles)

      // Observe head for dynamically inserted deferred link elements
      const headObserver = new MutationObserver(mutations => {
        for (const m of mutations) {
          for (const node of m.addedNodes) {
            try {
              if (node.nodeType === 1 && node.matches && node.matches('link[rel="stylesheet"][data-defer="1"]')) {
                node.media = 'all'
                node.removeAttribute('data-defer')
              }
            } catch (err) {
              /* ignore per-node errors */
            }
          }
        }
      })
      headObserver.observe(document.head || document.documentElement, {childList: true, subtree: true})
      // Disconnect after full load to avoid long-running observers
      window.addEventListener('load', () => headObserver.disconnect(), {once: true})
    } catch (e) {
      /* ignore overall activation errors */
    }

    // Delegated handlers for retry and share buttons to avoid inline handlers (CSP-compliant)
    document.addEventListener('click', event => {
      const target = event.target
      if (!target) return

      // Retry / reload buttons (class-based)
      const retry = target.closest && target.closest('.retry-btn')
      if (retry) {
        event.preventDefault()
        try {
          window.location.reload()
        } catch (e) {
          // fallback
          location.href = location.href
        }
        return
      }

      // Share button (degraded to clipboard if navigator.share not available)
      const share = target.closest && target.closest('.btn-share')
      if (share) {
        event.preventDefault()
        const shareUrl = share.getAttribute('data-share-url') || 'https://www.youtube.com/@aks.030'
        const shareData = {
          title: document.title,
          text: 'Schau dir diesen Kanal an',
          url: shareUrl
        }

        if (navigator.share) {
          navigator.share(shareData).catch(() => {})
        } else if (navigator.clipboard) {
          navigator.clipboard.writeText(shareUrl).then(() => {
            try {
              announce('Link kopiert', {dedupe: true})
            } catch (e) {}
          })
        } else {
          try {
            window.prompt('Link kopieren', shareUrl)
          } catch (e) {}
        }
        return
      }
    })

    // ===== Service Worker Registration =====
    if (!ENV.useServiceWorker) {
      log.info('Service Worker registration skipped: ENV.useServiceWorker is false')
    } else if ('serviceWorker' in navigator && !ENV.isTest) {
      window.addEventListener('load', async () => {
        try {
          const swUrl = '/sw.js'
          // Sanity-check the SW script before attempting registration to avoid noisy rejections
          let swResp = null
          try {
            swResp = await fetch(swUrl, {cache: 'no-store', credentials: 'same-origin'})
          } catch (e) {
            log.warn('Service Worker fetch failed, skipping registration', e)
            try {
              const payload = JSON.stringify({event: 'sw_fetch_failed', message: String(e), href: location.href, ts: Date.now()})
              if (navigator.sendBeacon) navigator.sendBeacon('/__sw_reg_err', payload)
              else fetch('/__sw_reg_err', {method: 'POST', body: payload, keepalive: true})
            } catch (beaconErr) {
              log.debug('SW error reporting failed', beaconErr)
            }
            return
          }

          const contentType = (swResp && swResp.headers && swResp.headers.get('content-type')) || ''
          if (!swResp.ok || !/javascript/i.test(contentType)) {
            log.warn('Service Worker not suitable for registration (status/content-type)', {status: swResp && swResp.status, contentType})
            try {
              const payload = JSON.stringify({
                event: 'sw_not_ok',
                status: swResp && swResp.status,
                contentType,
                href: location.href,
                ts: Date.now()
              })
              if (navigator.sendBeacon) navigator.sendBeacon('/__sw_reg_err', payload)
              else fetch('/__sw_reg_err', {method: 'POST', body: payload, keepalive: true})
            } catch (beaconErr) {
              log.debug('SW error reporting failed', beaconErr)
            }
            return
          }

          let swSnippet = null
          try {
            if (swResp && swResp.clone && typeof swResp.clone === 'function') {
              swSnippet = await swResp.clone().text()
              if (swSnippet && swSnippet.length > 2000) swSnippet = swSnippet.slice(0, 2000) + '…'
            }
          } catch (e) {
            swSnippet = `SNIPPET_ERROR: ${String(e)}`
          }

          let registration = null
          try {
            registration = await navigator.serviceWorker.register(swUrl, {scope: '/'})
            log.info('Service Worker registered:', registration && registration.scope)
          } catch (error) {
            log.error('Service Worker registration failed:', {
              name: error && error.name,
              message: error && error.message,
              stack: error && error.stack,
              swUrl,
              href: location.href,
              userAgent: navigator.userAgent || null,
              inIframe: window.self !== window.top
            })
            try {
              const payload = JSON.stringify({
                event: 'sw_registration_failed',
                name: error && error.name,
                message: error && error.message,
                stack: error && error.stack,
                swUrl,
                href: location.href,
                userAgent: navigator.userAgent || null,
                inIframe: window.self !== window.top,
                ts: Date.now()
              })
              if (navigator.sendBeacon) {
                navigator.sendBeacon('/__sw_reg_err', payload)
              } else {
                await fetch('/__sw_reg_err', {
                  method: 'POST',
                  body: payload,
                  keepalive: true
                })
              }
            } catch (reportErr) {
              log.debug('Failed to report SW registration error:', reportErr)
            }
          }

          // Check for updates periodically
          if (registration && registration.waiting) {
            log.info('Service Worker update available')
          }

          if (registration) {
            registration.addEventListener('updatefound', () => {
              const newWorker = registration.installing
              if (newWorker) {
                newWorker.addEventListener('statechange', () => {
                  if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    log.info('New Service Worker available - refresh to update')
                    // Optional: Show update notification to user
                    fire(EVENTS.SW_UPDATE_AVAILABLE)
                  }
                })
              }
            })
          }
        } catch (error) {
          log.warn('Service Worker registration failed:', error)
          try {
            const payloadObj = {
              message: error && error.message,
              name: error && error.name,
              stack: error && error.stack,
              href: location.href,
              ts: Date.now(),
              swStatus: swResp && swResp.status,
              swContentType: contentType,
              swUrl: swResp && swResp.url,
              swSnippet: typeof swSnippet === 'string' ? (swSnippet.length > 2000 ? swSnippet.slice(0, 2000) + '…' : swSnippet) : null
            }
            const payload = JSON.stringify(payloadObj)
            if (navigator.sendBeacon) {
              navigator.sendBeacon('/__sw_reg_err', payload)
            } else {
              fetch('/__sw_reg_err', {method: 'POST', body: payload, keepalive: true})
            }
          } catch (beaconErr) {
            log.debug('SW error reporting failed', beaconErr)
          }
        }
      })
    }

    log.info('Performance:', {
      domReady: Math.round(perfMarks.domReady - perfMarks.start),
      modulesReady: Math.round(perfMarks.modulesReady - perfMarks.start),
      windowLoaded: Math.round(perfMarks.windowLoaded - perfMarks.start)
    })

    // ===== Dev-only WebSocket test (optional) =====
    // Usage: add ?ws-test to the page URL or use debug mode to enable a reconnecting websocket to ws://127.0.0.1:3001
    if (!ENV.isTest && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || ENV.debug)) {
      const params = new URLSearchParams(window.location.search || '')
      if (params.has('ws-test') || ENV.debug) {
        import('./utils/reconnecting-websocket.js')
          .then(mod => {
            const {ReconnectingWebSocket} = mod
            try {
              const rws = new ReconnectingWebSocket('ws://127.0.0.1:3001')
              rws.onopen = () => {
                log.info('Dev ReconnectingWebSocket open on 127.0.0.1:3001')
                try {
                  rws.send('dev:hello')
                } catch (e) {
                  /* ignore */
                }
              }
              rws.onmessage = e => log.debug('[dev-ws]', e.data)
              rws.onclose = ev => log.info('Dev RWS closed', ev)
              rws.onerror = err => log.warn('Dev RWS error', err)

              // Attach for debugging
              window.__rws = rws
              if (ENV.debug) window.__devRws = rws
            } catch (ex) {
              log.warn('Failed to open Dev ReconnectingWebSocket:', ex)
            }
          })
          .catch(e => log.warn('Failed to import ReconnectingWebSocket', e))
      }
    }
  },
  {once: true}
)
