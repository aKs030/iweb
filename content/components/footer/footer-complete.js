/**
 * Footer Complete System - Ultra Optimized
 * @version 10.0.0
 * ✅ Event Delegation
 * ✅ DOM Caching
 * ✅ Debounced Resize
 * ✅ Memory Leak Prevention
 * ✅ Performance Monitoring
 */

import {createLogger, CookieManager} from '../../utils/shared-utilities.js'
import {a11y} from '../../utils/accessibility-manager.js'

const log = createLogger('FooterSystem')

// ===== Utilities =====
const debounce = (func, wait) => {
  let timeout
  return (...args) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

const memoize = fn => {
  const cache = new Map()
  return (...args) => {
    const key = JSON.stringify(args)
    if (cache.has(key)) return cache.get(key)
    const result = fn(...args)
    cache.set(key, result)
    return result
  }
}

// ===== Constants =====
const CONSTANTS = {
  SCROLL_MARK_DURATION: 1000,
  SCROLL_WATCH_TIMEOUT: 5000,
  SCROLL_THRESHOLD: 6,
  RESIZE_DEBOUNCE: 150,
  ANIMATION_DURATION: 800
}

// ===== DOM Cache =====
class DOMCache {
  constructor() {
    this.cache = new Map()
  }

  get(selector, parent = document) {
    const key = `${selector}-${parent === document ? 'doc' : 'parent'}`
    if (!this.cache.has(key)) {
      this.cache.set(key, parent.querySelector(selector))
    }
    return this.cache.get(key)
  }

  getAll(selector, parent = document) {
    const key = `all-${selector}`
    if (!this.cache.has(key)) {
      this.cache.set(key, Array.from(parent.querySelectorAll(selector)))
    }
    return this.cache.get(key)
  }

  invalidate(selector) {
    if (selector) {
      this.cache.delete(selector)
    } else {
      this.cache.clear()
    }
  }
}

const domCache = new DOMCache()

// ===== Programmatic Scroll (Optimized) =====
const ProgrammaticScroll = (() => {
  let activeToken = null
  let timer = null
  const watchers = new Map()

  return {
    create(duration = CONSTANTS.SCROLL_MARK_DURATION) {
      if (timer) clearTimeout(timer)

      const token = Symbol('progScroll')
      activeToken = token

      if (duration > 0) {
        timer = setTimeout(() => {
          if (activeToken === token) activeToken = null
          timer = null
        }, duration)
      }
      return token
    },

    clear(token) {
      if (!activeToken || (token && activeToken !== token)) return

      activeToken = null
      if (timer) clearTimeout(timer)
      timer = null

      if (watchers.has(token)) {
        const watcher = watchers.get(token)
        watcher.observer?.disconnect()
        if (watcher.listener) {
          window.removeEventListener('scroll', watcher.listener)
        }
        if (watcher.timeoutId) clearTimeout(watcher.timeoutId)
        watchers.delete(token)
      }
    },

    hasActive: () => !!activeToken,

    watchUntil(token, target, timeout = CONSTANTS.SCROLL_WATCH_TIMEOUT) {
      if (!token) return

      const element = typeof target === 'string' ? domCache.get(target) : target

      if (element && 'IntersectionObserver' in window) {
        const observer = new IntersectionObserver(
          entries => {
            const entry = entries[0]
            if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
              ProgrammaticScroll.clear(token)
            }
          },
          {threshold: [0.5, 1]}
        )

        observer.observe(element)
        const timeoutId = setTimeout(() => {
          ProgrammaticScroll.clear(token)
          observer.disconnect()
        }, timeout)

        watchers.set(token, {observer, timeoutId})
        return token
      }

      // Fallback
      const check = () => {
        const current = window.scrollY || window.pageYOffset
        const atBottom = window.innerHeight + current >= document.body.scrollHeight - CONSTANTS.SCROLL_THRESHOLD
        if (atBottom) ProgrammaticScroll.clear(token)
      }

      const listener = () => check()
      check()
      window.addEventListener('scroll', listener, {passive: true})

      const timeoutId = setTimeout(() => ProgrammaticScroll.clear(token), timeout)
      watchers.set(token, {listener, timeoutId})
      return token
    }
  }
})()

// ===== Global Close Handlers (Optimized) =====
const GlobalClose = (() => {
  let closeHandler = null
  let bound = false

  const onDocClick = e => {
    const footer = domCache.get('#site-footer')
    if (!footer?.classList.contains('footer-expanded')) return
    if (e.target.closest('#site-footer')) return
    closeHandler?.()
  }

  const onUserScroll = () => {
    if (ProgrammaticScroll.hasActive()) return
    const footer = domCache.get('#site-footer')
    if (!footer?.classList.contains('footer-expanded')) return
    closeHandler?.()
  }

  return {
    setCloseHandler: fn => (closeHandler = fn),

    bind() {
      if (bound) return

      // On mobile we ONLY want to close the footer when the user scrolls
      const isMobile = window.matchMedia && window.matchMedia('(max-width: 768px)').matches

      if (!isMobile) {
        // Desktop: click outside closes, and wheel/touchstart will also respect quick gestures
        document.addEventListener('click', onDocClick, {capture: true, passive: true})
        window.addEventListener('wheel', onUserScroll, {passive: true})
        window.addEventListener('touchstart', onUserScroll, {passive: true})
      } else {
        // Mobile: avoid closing on taps outside; only close on scroll (or touchmove)
        // use scroll and touchmove to detect actual scrolling gestures
        window.addEventListener('scroll', onUserScroll, {passive: true})
        window.addEventListener('touchmove', onUserScroll, {passive: true})
      }

      bound = true
    },

    unbind() {
      if (!bound) return
      // Remove both sets of listeners to be safe
      document.removeEventListener('click', onDocClick, true)
      window.removeEventListener('wheel', onUserScroll)
      window.removeEventListener('touchstart', onUserScroll)
      window.removeEventListener('scroll', onUserScroll)
      window.removeEventListener('touchmove', onUserScroll)
      bound = false
    }
  }
})()

// ===== Analytics =====
const GoogleAnalytics = {
  load() {
    performance.mark('analytics-load-start')

    const blockedScripts = document.querySelectorAll('script[data-consent="required"]')
    if (blockedScripts.length === 0) return

    blockedScripts.forEach(script => {
      const newScript = document.createElement('script')
      Array.from(script.attributes).forEach(attr => {
        if (attr.name === 'data-src') {
          newScript.setAttribute('src', attr.value)
        } else if (!['data-consent', 'type'].includes(attr.name)) {
          newScript.setAttribute(attr.name, attr.value)
        }
      })
      if (script.innerHTML.trim()) newScript.innerHTML = script.innerHTML
      script.parentNode.replaceChild(newScript, script)
    })

    performance.mark('analytics-load-end')
    performance.measure('analytics-load', 'analytics-load-start', 'analytics-load-end')
    log.info('Google Analytics loaded')
  }
}

// ===== Consent Banner (Optimized) =====
class ConsentBanner {
  constructor() {
    this.elements = {
      banner: domCache.get('#cookie-consent-banner'),
      acceptBtn: domCache.get('#accept-cookies-btn'),
      rejectBtn: domCache.get('#reject-cookies-btn')
    }
  }

  init() {
    const {banner, acceptBtn, rejectBtn} = this.elements
    if (!banner || !acceptBtn) return

    const consent = CookieManager.get('cookie_consent')

    if (consent === 'accepted') {
      GoogleAnalytics.load()
      banner.classList.add('hidden')
    } else if (consent === 'rejected') {
      banner.classList.add('hidden')
    } else {
      banner.classList.remove('hidden')
    }

    // Event Listeners
    acceptBtn.addEventListener('click', () => this.accept(), {once: false})
    rejectBtn?.addEventListener('click', () => this.reject(), {once: false})
  }

  accept() {
    this.elements.banner.classList.add('hidden')
    CookieManager.set('cookie_consent', 'accepted')
    GoogleAnalytics.load()
    try { a11y?.announce('Cookie-Präferenz: Alle Cookies akzeptiert', {priority: 'polite'}) } catch {}
  }

  reject() {
    this.elements.banner.classList.add('hidden')
    CookieManager.set('cookie_consent', 'rejected')
    try { a11y?.announce('Cookie-Präferenz: Nur notwendige Cookies akzeptiert', {priority: 'polite'}) } catch {}
  }
}

// ===== Cookie Settings (Optimized with Caching) =====
const CookieSettings = (() => {
  let elements = null
  // Use a Map so we can remove listeners when closing to avoid potential leaks
  const handlers = new Map()

  const getElements = memoize(() => ({
    footer: domCache.get('#site-footer'),
    footerMin: domCache.get('.footer-minimized'),
    footerMax: domCache.get('.footer-maximized'),
    cookieView: domCache.get('#footer-cookie-view'),
    normalContent: domCache.get('#footer-normal-content'),
    analyticsToggle: domCache.get('#footer-analytics-toggle'),
    closeBtn: domCache.get('#close-cookie-footer'),
    rejectAllBtn: domCache.get('#footer-reject-all'),
    acceptSelectedBtn: domCache.get('#footer-accept-selected'),
    acceptAllBtn: domCache.get('#footer-accept-all')
  }))

  const setupHandlers = elements => {
    const handlerMap = {
      closeBtn: () => close(),
      rejectAllBtn: () => {
        CookieManager.set('cookie_consent', 'rejected')
        CookieManager.deleteAnalytics()
        try { a11y?.announce('Cookie-Einstellungen: Nur notwendige Cookies aktiv', {priority: 'polite'}) } catch {}
        close()
        domCache.get('#cookie-consent-banner')?.classList.add('hidden')
      },
      acceptSelectedBtn: () => {
        if (elements.analyticsToggle?.checked) {
          CookieManager.set('cookie_consent', 'accepted')
          GoogleAnalytics.load()
          try { a11y?.announce('Cookie-Einstellungen gespeichert: Analyse aktiviert', {priority: 'polite'}) } catch {}
        } else {
          CookieManager.set('cookie_consent', 'rejected')
          CookieManager.deleteAnalytics()
          try { a11y?.announce('Cookie-Einstellungen gespeichert: Analyse deaktiviert', {priority: 'polite'}) } catch {}
        }
        close()
        domCache.get('#cookie-consent-banner')?.classList.add('hidden')
      },
      acceptAllBtn: () => {
        CookieManager.set('cookie_consent', 'accepted')
        GoogleAnalytics.load()
        try { a11y?.announce('Cookie-Einstellungen: Alle Cookies aktiviert', {priority: 'polite'}) } catch {}
        close()
        domCache.get('#cookie-consent-banner')?.classList.add('hidden')
      }
    }

    Object.entries(handlerMap).forEach(([key, handler]) => {
      const element = elements[key]
      if (element && !handlers.has(element)) {
        element.addEventListener('click', handler)
        handlers.set(element, handler)
      }
    })

    // Ensure we remove handlers on close to avoid leaks if DOM is replaced
    const removeHandlers = () => {
      handlers.forEach((handler, el) => {
        try {
          el.removeEventListener('click', handler)
        } catch {
          /* ignore */
        }
      })
      handlers.clear()
    }

    // Attach cleanup hook (will be called by closeFooter which unbinds GlobalClose and other cleanup)
    elements._removeHandlers = removeHandlers

    // Also attach the cleanup hook to the actual DOM nodes so closeFooter can call them
    try {
      if (elements.cookieView && typeof elements.cookieView === 'object') {
        elements.cookieView._removeHandlers = removeHandlers
      }
      if (elements.normalContent && typeof elements.normalContent === 'object') {
        elements.normalContent._removeHandlers = removeHandlers
      }
    } catch {
      /* ignore */
    }

  }

  const open = () => {
    performance.mark('cookie-settings-open-start')

    elements = getElements()
    if (!elements.footer || !elements.cookieView) return

    const consent = CookieManager.get('cookie_consent')
    if (elements.analyticsToggle) {
      elements.analyticsToggle.checked = consent === 'accepted'
    }

    document.documentElement.style.scrollSnapType = 'none'

    elements.footer.classList.add('footer-expanded')
    document.body.classList.add('footer-expanded')
    elements.footerMin?.classList.add('footer-hidden')
    elements.footerMax?.classList.remove('footer-hidden')
    elements.cookieView.classList.remove('hidden')
    if (elements.normalContent) elements.normalContent.style.display = 'none'

    requestAnimationFrame(() => window.scrollTo({top: document.body.scrollHeight, behavior: 'auto'}))

    ProgrammaticScroll.create(CONSTANTS.SCROLL_MARK_DURATION)
    GlobalClose.bind()
    setupHandlers(elements)

    try {
      a11y?.trapFocus(elements.cookieView)
    } catch (e) {
      log.warn('Focus trap failed', e)
    }

    performance.mark('cookie-settings-open-end')
    performance.measure('cookie-settings-open', 'cookie-settings-open-start', 'cookie-settings-open-end')
  }

  const close = () => {
    if (!elements) elements = getElements()
    if (!elements.footer) return

    // Hide cookie-specific view immediately
    try {
      elements.cookieView?.classList?.add('hidden')
    } catch {
      /* ignore */
    }

    // Remove any attached handlers to avoid memory leaks
    try {
      if (elements._removeHandlers) elements._removeHandlers()
      if (elements.cookieView && elements.cookieView._removeHandlers) elements.cookieView._removeHandlers()
      if (elements.normalContent && elements.normalContent._removeHandlers) elements.normalContent._removeHandlers()
    } catch {
      /* ignore */
    }

    // Clear the cached elements reference
    elements = null

    // Centralized footer cleanup
    closeFooter()
  }

  return {open, close}
})()

GlobalClose.setCloseHandler(() => CookieSettings.close())

// Central footer close helper — unified cleanup logic
function closeFooter() {
  const footer = domCache.get('#site-footer')
  if (!footer) return

  // Visual state
  footer.classList.remove('footer-expanded')
  document.body.classList.remove('footer-expanded')
  footer.querySelector('.footer-maximized')?.classList.add('footer-hidden')
  footer.querySelector('.footer-minimized')?.classList.remove('footer-hidden')

  // Restore normal content visibility
  const normal = domCache.get('#footer-normal-content')
  if (normal) normal.style.display = 'block'

  // Restore document styles
  document.documentElement.style.removeProperty('scroll-snap-type')

  // Footer scroll state
  if (window.footerScrollHandler) window.footerScrollHandler.expanded = false

  // Unbind global close handlers
  GlobalClose.unbind()

  // Remove any component-specific handlers (cookie handlers etc.)
  try {
    const normal = domCache.get('#footer-normal-content')
    const cookieEl = domCache.get('#footer-cookie-view')
    if (cookieEl && cookieEl._removeHandlers) cookieEl._removeHandlers()
    if (normal && normal._removeHandlers) normal._removeHandlers()
  } catch {
    /* ignore */
  }

  // Accessibility cleanup
  try {
    a11y?.releaseFocus()
  } catch (e) {
    log.warn('Focus release failed', e)
  }
}


// Listen for close requests from other modules (a11y, keyboard handlers, etc.)
document.addEventListener('footer:requestClose', () => {
  try {
    closeFooter()
  } catch (e) {
    log.warn('footer:requestClose failed', e)
  }
})

// ===== Footer Loader (Optimized) =====
class FooterLoader {
  async init() {
    performance.mark('footer-load-start')

    const container = domCache.get('#footer-container')
    if (!container) return false

    try {
      // Prefer extensionless path to avoid redirect noise (fallback to .html handled by server if needed)
      const srcBase = container.dataset.footerSrc || '/content/components/footer/footer'
      const isLocal = location.hostname === 'localhost' || location.hostname.startsWith('127.') || location.hostname.endsWith('.local')
      const candidates = isLocal ? [srcBase + '.html', srcBase] : [srcBase, srcBase + '.html']
      let response
      for (const c of candidates) {
        try {
          response = await fetch(c)
          if (response.ok) break
        } catch (err) {
          log.warn('FooterLoader: fetch candidate failed', err)
          response = null
        }
      }

      if (!response || !response.ok) throw new Error(`HTTP ${response ? response.status : 'NO_RESPONSE'}`)

      container.innerHTML = await response.text()
      domCache.invalidate() // Clear cache after DOM change

      this.updateYears()
      this.setupInteractions()

      new ConsentBanner().init()
      new ScrollHandler().init()
      new FooterResizer().init()

      document.dispatchEvent(
        new CustomEvent('footer:loaded', {
          detail: {footerId: 'site-footer', timestamp: Date.now()}
        })
      )

      performance.mark('footer-load-end')
      performance.measure('footer-load', 'footer-load-start', 'footer-load-end')

      return true
    } catch (error) {
      log.error('Footer load failed', error)
      return false
    }
  }

  updateYears() {
    const year = new Date().getFullYear()
    domCache.getAll('.current-year').forEach(el => (el.textContent = year))
  }

  setupInteractions() {
    // Newsletter Form
    const form = domCache.get('.newsletter-form-enhanced')
    if (form) {
      form.addEventListener('submit', e => {
        e.preventDefault()
        const input = form.querySelector('#newsletter-email')
        // Client-side validation
        if (input && !input.checkValidity()) {
          try {
            a11y?.announce('Bitte gültige E-Mail-Adresse eingeben', {priority: 'assertive'})
          } catch {
            /* ignore */
          }
          try {
            input.focus()
          } catch {
            /* ignore */
          }
          return
        }

        const btn = form.querySelector('button[type="submit"]')
        if (btn) {
          const originalText = btn.textContent
          btn.textContent = '✓'
          btn.disabled = true
          setTimeout(() => {
            btn.textContent = originalText
            btn.disabled = false
          }, 3000)
        }
        form.reset()
        // Accessibility: announce success for screen readers
        try {
          a11y?.announce('Newsletter-Abonnement bestätigt', {priority: 'polite'})
        } catch {
          /* ignore */
        }
      })
    }

    // Event Delegation for Cookie & Footer Triggers
    document.addEventListener(
      'click',
      e => {
        const cookieTrigger = e.target.closest('[data-cookie-trigger]')
        const footerTrigger = e.target.closest('[data-footer-trigger]')

        if (cookieTrigger) {
          e.preventDefault()
          CookieSettings.open()
          return
        }

        if (footerTrigger) {
          e.preventDefault()
          this.handleFooterTrigger()
        }
      },
      {passive: false}
    )

    // Three-Earth Showcase Button (in maximized footer)
    const showcaseBtn = domCache.get('#threeShowcaseBtn')
    if (showcaseBtn && !showcaseBtn.dataset.showcaseAttached) {
      showcaseBtn.dataset.showcaseAttached = '1'
      const SHOWCASE_DURATION = 8000 // ms
      const dispatchShowcase = dur => document.dispatchEvent(new CustomEvent('three-earth:showcase', {detail: {duration: dur}}))

      const onShowcase = () => {
        if (showcaseBtn.disabled) return
        showcaseBtn.disabled = true
        showcaseBtn.setAttribute('aria-pressed', 'true')
        showcaseBtn.classList.add('active')
        // small visual feedback
        showcaseBtn.animate([{transform: 'scale(0.95)'}, {transform: 'scale(1)'}], {duration: 250, easing: 'ease-out'})
        dispatchShowcase(SHOWCASE_DURATION)
        setTimeout(() => {
          showcaseBtn.disabled = false
          showcaseBtn.setAttribute('aria-pressed', 'false')
          showcaseBtn.classList.remove('active')
        }, SHOWCASE_DURATION)
      }

      showcaseBtn.addEventListener('click', onShowcase)

      showcaseBtn.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onShowcase()
        }
      })
    }
  }

  handleFooterTrigger() {
    if (window.footerScrollHandler) {
      window.footerScrollHandler.toggleExpansion(true)
    } else {
      const footer = domCache.get('#site-footer')
      if (footer) {
        document.documentElement.style.scrollSnapType = 'none'
        footer.classList.add('footer-expanded')
        document.body.classList.add('footer-expanded')
        footer.querySelector('.footer-minimized')?.classList.add('footer-hidden')
        footer.querySelector('.footer-maximized')?.classList.remove('footer-hidden')

        const token = ProgrammaticScroll.create()
        window.scrollTo({top: document.body.scrollHeight, behavior: 'smooth'})
        ProgrammaticScroll.watchUntil(token, '.footer-maximized-viewport')
      }
    }
  }
}

// ===== Scroll Handler (Optimized) =====
class ScrollHandler {
  constructor() {
    this.expanded = false
    this.observer = null
    this._resizeHandler = null
    // Threshold defaults (may be overridden by trigger dataset)
    this.expandThreshold = 0.05
    this.collapseThreshold = 0.02
    // Suppression window (ms) after expansion to prevent immediate collapse from transient IO events
    this._collapseSuppressMs = 350
    this._suppressCollapseUntil = 0
    window.footerScrollHandler = this
  }

  init() {
    const footer = domCache.get('#site-footer')
    const trigger = domCache.get('#footer-trigger-zone')

    if (footer) {
      footer.querySelector('.footer-minimized')?.classList.remove('footer-hidden')
      footer.querySelector('.footer-maximized')?.classList.add('footer-hidden')
    }

    if (!footer || !trigger) return

    // Determine thresholds: prefer explicit per-page trigger dataset values if provided
    const isDesktop = window.matchMedia && window.matchMedia('(min-width: 769px)').matches

    // Defaults based on device type
    const defaultExpand = isDesktop ? 0.005 : 0.05
    const defaultCollapse = isDesktop ? 0.002 : 0.02

    // If page author provided dataset attributes on trigger, those override defaults
    try {
      const expandAttr = trigger.dataset && trigger.dataset.expandThreshold
      const collapseAttr = trigger.dataset && trigger.dataset.collapseThreshold
      const parsedExpand = expandAttr ? parseFloat(expandAttr) : NaN
      const parsedCollapse = collapseAttr ? parseFloat(collapseAttr) : NaN

      this.expandThreshold = !Number.isNaN(parsedExpand) && parsedExpand >= 0 && parsedExpand <= 1 ? parsedExpand : defaultExpand
      this.collapseThreshold = !Number.isNaN(parsedCollapse) && parsedCollapse >= 0 && parsedCollapse <= 1 ? parsedCollapse : defaultCollapse
    } catch {
      this.expandThreshold = defaultExpand
      this.collapseThreshold = defaultCollapse
    }

    // Smaller negative rootMargin on desktop makes the observer more likely to fire on small scrolls
    const rootMargin = isDesktop ? '0px 0px -1% 0px' : '0px 0px -10% 0px'

    this.observer = new IntersectionObserver(
      entries => {
        const entry = entries[0]
        if (entry.target.id !== 'footer-trigger-zone') return

        if (!entry.isIntersecting && ProgrammaticScroll.hasActive()) return

        // Determine current state
        const nowRatio = entry.intersectionRatio || 0
        const isSignificant = entry.isIntersecting && nowRatio >= this.expandThreshold
        const isInsignificant = !entry.isIntersecting || nowRatio < this.collapseThreshold

        // If we detect an expand gesture and footer is not expanded, expand and suppress immediate collapse for a short window
        if (isSignificant && !this.expanded) {
          this._suppressCollapseUntil = Date.now() + (this._collapseSuppressMs || 350)
          this.toggleExpansion(true)
          return
        }

        // If it's a collapse candidate and footer is expanded, only collapse if the suppress window has passed
        if (isInsignificant && this.expanded) {
          if (Date.now() < (this._suppressCollapseUntil || 0)) {
            // Ignore transient collapse
            return
          }
          this.toggleExpansion(false)
          return
        }

        // Otherwise do nothing (avoids flapping on intermediate ratios)
      },
      {rootMargin, threshold: [this.collapseThreshold, this.expandThreshold]}
    )

    this.observer.observe(trigger)

    // Re-init observer on resize/orientation changes to adapt thresholds
    this._resizeHandler = debounce(() => {
      try {
        this.observer?.disconnect()
        this.init()
      } catch {
        /* ignore */
      }
    }, 150)

    window.addEventListener('resize', this._resizeHandler, {passive: true})
  }

  toggleExpansion(shouldExpand) {
    const footer = domCache.get('#site-footer')
    if (!footer) return

    const min = footer.querySelector('.footer-minimized')
    const max = footer.querySelector('.footer-maximized')

    if (shouldExpand && !this.expanded) {
      ProgrammaticScroll.create(1000)
      GlobalClose.bind()
      document.documentElement.style.scrollSnapType = 'none'

      footer.classList.add('footer-expanded')
      document.body.classList.add('footer-expanded')
      max?.classList.remove('footer-hidden')
      min?.classList.add('footer-hidden')

      this.expanded = true
    } else if (!shouldExpand && this.expanded) {
      // Use centralized close handler to ensure consistent cleanup
      closeFooter()
      this.expanded = false
    }
  }

  cleanup() {
    this.observer?.disconnect()
    if (this._resizeHandler) window.removeEventListener('resize', this._resizeHandler)
  }
}

// ===== Footer Resizer (Optimized with Debouncing) =====
class FooterResizer {
  constructor() {
    this.apply = this.apply.bind(this)
    this.debouncedApply = debounce(this.apply, CONSTANTS.RESIZE_DEBOUNCE)
  }

  init() {
    window.addEventListener('resize', this.debouncedApply, {passive: true})
    this.apply()
  }

  apply() {
    const content = domCache.get('#site-footer .footer-enhanced-content')
    if (!content) return

    const height = Math.min(Math.max(0, content.scrollHeight), window.innerHeight - 24)

    if (height > 0) {
      document.documentElement.style.setProperty('--footer-actual-height', `${height}px`)
    }
  }

  cleanup() {
    window.removeEventListener('resize', this.debouncedApply)
  }
}

// ===== Auto-Start =====
const initFooter = () => new FooterLoader().init()

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initFooter, {once: true})
} else {
  initFooter()
}

// ===== Public API =====
// Expose minimal API in debug/local mode only to avoid leaking internals in production
if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname.startsWith('127.') || (typeof ENV !== 'undefined' && ENV.debug))) {
  window.FooterSystem = {
    FooterLoader,
    CookieSettings,
    ProgrammaticScroll,
    domCache
  }
}
