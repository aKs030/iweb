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
  } catch {
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
  debug: new URLSearchParams(window.location.search).has('debug')
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
  // Retry logic removed: we do not perform automatic retry attempts for section loads

  function dispatchEvent(type, section, detail = {}) {
    try {
      document.dispatchEvent(
        new CustomEvent(type, {
          detail: {id: section?.id, section, ...detail}
        })
      )
    } catch (error) {
      log.debug(`Event dispatch failed: ${type}: ${error?.message || error}`)
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

    section.setAttribute('aria-busy', 'true')
    section.dataset.state = 'loading'

    // Loading screen removed — no global loader to request

    announce(`Lade ${sectionName}…`, {dedupe: true})
    dispatchEvent('section:will-load', section, {url})

    try {
      const response = await fetchWithTimeout(url)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
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
      log.warn(`Section load failed: ${sectionName}: ${error?.message || error}`)

      // No automatic retries: mark section error and dispatch
      section.dataset.state = 'error'
      section.removeAttribute('aria-busy')

      announce(`Fehler beim Laden von ${sectionName}`, {assertive: true})
      dispatchEvent('section:error', section, {state: 'error'})

      // Instead of injecting a retry button, we leave a simple error box (no retry control)
      if (!section.querySelector('.section-error-box')) {
        const wrapper = document.createElement('div')
        wrapper.className = 'section-error-box'
        const p = document.createElement('p')
        p.textContent = 'Inhalt konnte nicht geladen werden.'
        wrapper.appendChild(p)
        section.appendChild(wrapper)
      }

      // Allow manual retry: clear loaded mark so `loadSection(section)` can be called again
      try {
        loadedSections.delete(section)
      } catch (e) {
        /* ignore */
      }
    } finally {
      // Loading screen removed — no global owner to release
    }
  }

  // injectRetryUI removed; kept inline in loadSection() to avoid small helper function

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

  const api = {init, reinit, loadSection}
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
  } catch {
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

    fire(EVENTS.DOM_READY)

    // Simplified TypeWriter Export
    window.initHeroSubtitle = initHeroSubtitle

    let modulesReady = false
    let windowLoaded = false

    const checkReady = () => {
      if (!modulesReady || !windowLoaded) return
      // App ready — no global loading screen to hide
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
            log.debug(`AppLoadManager check failed: ${e?.message || e}`)
          }

          // Loading screen removed — avoid alarming warnings, keep a debug-level message instead
          log.debug('Forced loading-screen hide requested but global loader has been removed; ignoring')
        },
        attempt === 1 ? INITIAL_DELAY : RETRY_DELAY
      )
    })()

    schedulePersistentStorageRequest(2200)

    // ===== Service Worker Registration =====
    if ('serviceWorker' in navigator && !ENV.isTest) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js', {scope: '/'})
          .then(registration => {
            log.info('Service Worker registered:', registration.scope)

            // Check for updates periodically
            if (registration.waiting) {
              log.info('Service Worker update available')
            }

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
          })
          .catch(error => {
            log.warn('Service Worker registration failed:', error)
          })
      })
    }

    log.info(
      `Performance: domReady=${Math.round(perfMarks.domReady - perfMarks.start)}ms modulesReady=${Math.round(perfMarks.modulesReady - perfMarks.start)}ms windowLoaded=${Math.round(perfMarks.windowLoaded - perfMarks.start)}ms`
    )

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
                } catch {
                  /* ignore */
                }
              }
              rws.onmessage = e => log.debug('[dev-ws]', e.data)
              rws.onclose = ev => log.info(`Dev RWS closed: code=${ev?.code || 'N/A'} reason=${ev?.reason || 'N/A'}`)
              rws.onerror = err => log.warn(`Dev RWS error: ${err?.message || err}`)

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
