/**
 * Footer Complete System - Ultra Optimized & Fixed
 * @version 10.1.0
 * ✅ Event Delegation & DOM Caching
 * ✅ Auto-Injection of Scroll Trigger
 * ✅ Accessibility State Management (ARIA)
 * ✅ Robust Error Handling & Fallbacks
 */

// Importversuch mit Fallback für Standalone-Nutzung
let createLogger, CookieManager, a11y;
try {
  ({ createLogger, CookieManager } = await import('../../utils/shared-utilities.js').catch(() => { throw new Error('Utils missing') }));
  ({ a11y } = await import('../../utils/accessibility-manager.js').catch(() => { throw new Error('A11y missing') }));
} catch (err) {
  // If imports fail in a standalone environment, fall back to safe no-op mocks.
  // Log as warning to make failures visible during development without throwing.
  console.warn('Footer imports fallback active', err)
  createLogger = () => ({ info: console.warn, warn: console.warn, error: console.error });
  CookieManager = {
    get: (k) => localStorage.getItem(k),
    set: (k, v) => localStorage.setItem(k, v),
    deleteAnalytics: () => console.warn('Analytics deleted (Mock)')
  };
  a11y = {
    announce: (msg) => console.warn(`[A11y]: ${msg}`),
    trapFocus: () => {},
    releaseFocus: () => {}
  };
} 

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
  ANIMATION_DURATION: 800,
  // How long to keep footer expanded after a first expand (ms)
  EXPAND_LOCK_MS: 300,
  // Debounce delay before actually collapsing (ms)
  COLLAPSE_DEBOUNCE_MS: 200
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
      // Auch alle Varianten löschen (doc/parent)
      for (const key of this.cache.keys()) {
        if (key.startsWith(selector)) this.cache.delete(key)
      }
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
    // Ignore clicks inside the footer
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

      const isMobile = window.matchMedia && window.matchMedia('(max-width: 768px)').matches

      if (!isMobile) {
        document.addEventListener('click', onDocClick, {capture: true, passive: true})
        window.addEventListener('wheel', onUserScroll, {passive: true})
        window.addEventListener('touchstart', onUserScroll, {passive: true})
      } else {
        // Mobile: only close on actual scroll movement
        window.addEventListener('scroll', onUserScroll, {passive: true})
        window.addEventListener('touchmove', onUserScroll, {passive: true})
      }

      bound = true
    },

    unbind() {
      if (!bound) return
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

// ===== Cookie Settings (Optimized) =====
const CookieSettings = (() => {
  let elements = null
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
    acceptAllBtn: domCache.get('#footer-accept-all'),
    triggerBtn: domCache.get('#footer-cookies-link') // Für aria-expanded
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

    const removeHandlers = () => {
      handlers.forEach((handler, el) => {
        try { el.removeEventListener('click', handler) } catch {}
      })
      handlers.clear()
    }
    
    // Attach cleanup to cookieView so closeFooter can access it
    if(elements.cookieView) elements.cookieView._removeHandlers = removeHandlers
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
    
    // Accessibility Update
    if (elements.triggerBtn) elements.triggerBtn.setAttribute('aria-expanded', 'true')

    requestAnimationFrame(() => window.scrollTo({top: document.body.scrollHeight, behavior: 'auto'}))

    ProgrammaticScroll.create(CONSTANTS.SCROLL_MARK_DURATION)
    GlobalClose.bind()
    setupHandlers(elements)

    try { a11y?.trapFocus(elements.cookieView) } catch (e) { log.warn('Focus trap failed', e) }

    performance.mark('cookie-settings-open-end')
    performance.measure('cookie-settings-open', 'cookie-settings-open-start', 'cookie-settings-open-end')
  }

  const close = () => {
    if (!elements) elements = getElements()
    
    // Reset Accessibility
    if (elements && elements.triggerBtn) elements.triggerBtn.setAttribute('aria-expanded', 'false')

    // Centralized cleanup
    closeFooter()
  }

  return {open, close}
})()

GlobalClose.setCloseHandler(() => CookieSettings.close())

// ===== Central Footer Cleanup Helper =====
function closeFooter() {
  const footer = domCache.get('#site-footer')
  if (!footer) return

  // 1. Visual Reset
  footer.classList.remove('footer-expanded')
  document.body.classList.remove('footer-expanded')
  footer.querySelector('.footer-maximized')?.classList.add('footer-hidden')
  footer.querySelector('.footer-minimized')?.classList.remove('footer-hidden')
  
  // 2. Content Reset (show normal content again if it was hidden by cookie view)
  const normal = domCache.get('#footer-normal-content')
  if (normal) normal.style.display = 'block'
  
  // 3. Hide Cookie View specifically
  const cookieView = domCache.get('#footer-cookie-view')
  if (cookieView) cookieView.classList.add('hidden')

  // 4. Style Reset
  document.documentElement.style.removeProperty('scroll-snap-type')

  // 5. State Reset
  if (window.footerScrollHandler) window.footerScrollHandler.expanded = false

  // 6. Listener Cleanup
  GlobalClose.unbind()
  
  // Remove component-specific handlers stored on DOM elements
  try {
    if (cookieView && cookieView._removeHandlers) cookieView._removeHandlers()
    if (normal && normal._removeHandlers) normal._removeHandlers()
  } catch { /* ignore */ }

  // 7. A11y Reset
  try { a11y?.releaseFocus() } catch (e) { log.warn('Focus release failed', e) }
}

document.addEventListener('footer:requestClose', closeFooter)

// ===== Footer Loader (Optimized) =====
class FooterLoader {
  async init() {
    performance.mark('footer-load-start')
    const container = domCache.get('#footer-container')
    
    // If no container, assume footer is already in DOM (static) and just init logic
    if (!container) {
        if (domCache.get('#site-footer')) {
            this.updateYears()
            this.setupInteractions()
            new ConsentBanner().init()
            new ScrollHandler().init()
            new FooterResizer().init()
            return true
        }
        return false
    }

    try {
      const srcBase = container.dataset.footerSrc || '/content/components/footer/footer'
      const isLocal = ['localhost', '127.0.0.1'].some(h => location.hostname.includes(h)) || location.hostname.endsWith('.local')
      const candidates = isLocal ? [srcBase + '.html', srcBase] : [srcBase, srcBase + '.html']
      
      let response
      for (const c of candidates) {
        try {
          response = await fetch(c)
          if (response.ok) break
        } catch { response = null }
      }

      if (!response || !response.ok) throw new Error('Footer load failed')

      container.innerHTML = await response.text()
      domCache.invalidate()

      this.updateYears()
      this.setupInteractions()

      new ConsentBanner().init()
      new ScrollHandler().init()
      new FooterResizer().init()

      document.dispatchEvent(new CustomEvent('footer:loaded', { detail: { timestamp: Date.now() } }))

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
        if (input && !input.checkValidity()) {
          try { a11y?.announce('Bitte gültige E-Mail eingeben', {priority: 'assertive'}) } catch {}
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
        try { a11y?.announce('Newsletter abonniert', {priority: 'polite'}) } catch {}
      })
    }

    // Event Delegation
    document.addEventListener('click', e => {
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
      }, {passive: false}
    )

    // Three-Showcase Button
    const showcaseBtn = domCache.get('#threeShowcaseBtn')
    if (showcaseBtn && !showcaseBtn.dataset.init) {
        showcaseBtn.dataset.init = '1'
        showcaseBtn.addEventListener('click', () => {
            showcaseBtn.classList.add('active')
            document.dispatchEvent(new CustomEvent('three-earth:showcase', {detail: {duration: 8000}}))
            setTimeout(() => showcaseBtn.classList.remove('active'), 8000)
        })
    }
  }

  handleFooterTrigger() {
    if (window.footerScrollHandler) {
      window.footerScrollHandler.toggleExpansion(true)
    }
  }
}

// ===== Scroll Handler (Fixed & Optimized) =====
class ScrollHandler {
  constructor() {
    this.expanded = false
    this.observer = null
    this._resizeHandler = null
    this.expandThreshold = 0.05
    this.collapseThreshold = 0.02
    // Collapse debounce timer and expand lock timestamp
    this._collapseTimer = null
    this._lockUntil = 0
    window.footerScrollHandler = this
  }

  init() {
    const footer = domCache.get('#site-footer')
    
    // CRITICAL FIX: Trigger Injection
    // Check if trigger zone exists, if not, inject it at the end of body/content
    let trigger = domCache.get('#footer-trigger-zone')
    if (!trigger) {
        trigger = document.createElement('div')
        trigger.id = 'footer-trigger-zone'
        trigger.className = 'footer-trigger-zone'
        // Insert before footer container if exists, else append to body
        const container = domCache.get('#footer-container')
        if (container) {
            container.parentNode.insertBefore(trigger, container)
        } else {
            document.body.appendChild(trigger)
        }
        domCache.invalidate('#footer-trigger-zone')
    }

    if (!footer || !trigger) return

    // Initial State Check
    footer.querySelector('.footer-minimized')?.classList.remove('footer-hidden')
    footer.querySelector('.footer-maximized')?.classList.add('footer-hidden')

    const isDesktop = window.matchMedia && window.matchMedia('(min-width: 769px)').matches
    const defaultExpand = isDesktop ? 0.005 : 0.05
    const defaultCollapse = isDesktop ? 0.002 : 0.02

    // Thresholds from dataset
    try {
      const { expandThreshold, collapseThreshold } = trigger.dataset
      this.expandThreshold = expandThreshold ? parseFloat(expandThreshold) : defaultExpand
      this.collapseThreshold = collapseThreshold ? parseFloat(collapseThreshold) : defaultCollapse
    } catch {
      this.expandThreshold = defaultExpand
      this.collapseThreshold = defaultCollapse
    }

    const rootMargin = isDesktop ? '0px 0px -1% 0px' : '0px 0px -10% 0px'

    this.observer = new IntersectionObserver(entries => {
        const entry = entries[0]
        if (!entry.isIntersecting && ProgrammaticScroll.hasActive()) return

        // Logic: Expand if we hit the bottom trigger significantly
        const shouldExpand = entry.isIntersecting && entry.intersectionRatio >= this.expandThreshold
        
        // Prevent collapse if we are just slightly scrolling but still near bottom
        if (!shouldExpand && this.expanded && entry.intersectionRatio > this.collapseThreshold) return

        this.toggleExpansion(shouldExpand)
      }, 
      { rootMargin, threshold: [this.collapseThreshold, this.expandThreshold] }
    )

    this.observer.observe(trigger)

    this._resizeHandler = debounce(() => {
      this.observer?.disconnect()
      this.init()
    }, 150)
    window.addEventListener('resize', this._resizeHandler, {passive: true})
  }

  toggleExpansion(shouldExpand) {
    const footer = domCache.get('#site-footer')
    if (!footer) return

    const min = footer.querySelector('.footer-minimized')
    const max = footer.querySelector('.footer-maximized')

    const now = Date.now()

    if (shouldExpand) {
      // Cancel pending collapse and expand immediately
      if (this._collapseTimer) { clearTimeout(this._collapseTimer); this._collapseTimer = null }

      if (!this.expanded) {
        ProgrammaticScroll.create(1000)
        GlobalClose.bind()
        document.documentElement.style.scrollSnapType = 'none'

        footer.classList.add('footer-expanded')
        document.body.classList.add('footer-expanded')
        max?.classList.remove('footer-hidden')
        min?.classList.add('footer-hidden')

        this.expanded = true
      }

      // Set lock so minor reflows or momentary oob checks won't collapse immediately
      this._lockUntil = now + CONSTANTS.EXPAND_LOCK_MS
      return
    }

    // Collapse requested: respect lock period
    if (now < (this._lockUntil || 0)) return

    // Debounce actual collapse to avoid flapping
    if (this._collapseTimer) clearTimeout(this._collapseTimer)
    this._collapseTimer = setTimeout(() => {
      if (this.expanded) {
        closeFooter()
        this.expanded = false
      }
      this._collapseTimer = null
    }, CONSTANTS.COLLAPSE_DEBOUNCE_MS)
  }

  cleanup() {
    this.observer?.disconnect()
    if (this._resizeHandler) window.removeEventListener('resize', this._resizeHandler)
    if (this._collapseTimer) { clearTimeout(this._collapseTimer); this._collapseTimer = null }
  }
}

// ===== Footer Resizer (Optimized) =====
class FooterResizer {
  constructor() {
    this.debouncedApply = debounce(this.apply.bind(this), CONSTANTS.RESIZE_DEBOUNCE)
  }

  init() {
    window.addEventListener('resize', this.debouncedApply, {passive: true})
    this.apply()
  }

  apply() {
    const content = domCache.get('#site-footer .footer-enhanced-content')
    if (!content) return
    const height = Math.min(Math.max(0, content.scrollHeight), window.innerHeight - 24)
    if (height > 0) document.documentElement.style.setProperty('--footer-actual-height', `${height}px`)
  }
}

// ===== Auto-Start =====
const initFooter = () => new FooterLoader().init()
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initFooter, {once: true})
else initFooter()