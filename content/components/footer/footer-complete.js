/**
 * Footer Complete System - Ultra Optimized
 * @version 10.1.0
 * ✅ Event Delegation
 * ✅ DOM Caching
 * ✅ Programmatic Scroll (Preserved)
 * ✅ Simplified Toggle Logic
 */

import {createLogger, CookieManager} from '../../utils/shared-utilities.js'
import {a11y} from '../../utils/accessibility-manager.js'

const log = createLogger('FooterSystem')

// ===== Constants =====
const CONSTANTS = {
  SCROLL_MARK_DURATION: 1000,
  SCROLL_WATCH_TIMEOUT: 5000,
  SCROLL_THRESHOLD: 6,
  RESIZE_DEBOUNCE: 150,
  ANIMATION_DURATION: 800
}

// ===== DOM Cache (Preserved) =====
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

// ===== Programmatic Scroll (Preserved as Requested) =====
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

// ===== Global Close Handlers =====
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
      document.addEventListener('click', onDocClick, {capture: true, passive: true})
      window.addEventListener('wheel', onUserScroll, {passive: true})
      window.addEventListener('touchstart', onUserScroll, {passive: true})
      bound = true
    },

    unbind() {
      if (!bound) return
      document.removeEventListener('click', onDocClick, true)
      window.removeEventListener('wheel', onUserScroll)
      window.removeEventListener('touchstart', onUserScroll)
      bound = false
    }
  }
})()

// ===== Analytics =====
const GoogleAnalytics = {
  load() {
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
    log.info('Google Analytics loaded')
  }
}

// ===== Consent Banner (Compact) =====
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
    acceptBtn.addEventListener('click', () => this.accept())
    rejectBtn?.addEventListener('click', () => this.reject())
  }

  accept() {
    this.elements.banner.classList.add('hidden')
    CookieManager.set('cookie_consent', 'accepted')
    GoogleAnalytics.load()
  }

  reject() {
    this.elements.banner.classList.add('hidden')
    CookieManager.set('cookie_consent', 'rejected')
  }
}

// ===== Cookie Settings =====
const CookieSettings = (() => {
  let elements = null

  const getElements = () => {
    if (elements) return elements
    elements = {
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
    }
    return elements
  }

  const setupHandlers = () => {
    const el = getElements()

    const close = () => {
      CookieSettings.close()
    }

    const rejectAll = () => {
      CookieManager.set('cookie_consent', 'rejected')
      CookieManager.deleteAnalytics()
      close()
      domCache.get('#cookie-consent-banner')?.classList.add('hidden')
    }

    const acceptSelected = () => {
      if (el.analyticsToggle?.checked) {
        CookieManager.set('cookie_consent', 'accepted')
        GoogleAnalytics.load()
      } else {
        CookieManager.set('cookie_consent', 'rejected')
        CookieManager.deleteAnalytics()
      }
      close()
      domCache.get('#cookie-consent-banner')?.classList.add('hidden')
    }

    const acceptAll = () => {
      CookieManager.set('cookie_consent', 'accepted')
      GoogleAnalytics.load()
      close()
      domCache.get('#cookie-consent-banner')?.classList.add('hidden')
    }

    el.closeBtn?.addEventListener('click', close)
    el.rejectAllBtn?.addEventListener('click', rejectAll)
    el.acceptSelectedBtn?.addEventListener('click', acceptSelected)
    el.acceptAllBtn?.addEventListener('click', acceptAll)
  }

  const open = () => {
    const el = getElements()
    if (!el.footer || !el.cookieView) return

    const consent = CookieManager.get('cookie_consent')
    if (el.analyticsToggle) {
      el.analyticsToggle.checked = consent === 'accepted'
    }

    document.documentElement.style.scrollSnapType = 'none'

    el.footer.classList.add('footer-expanded')
    document.body.classList.add('footer-expanded')
    el.footerMin?.classList.add('footer-hidden')
    el.footerMax?.classList.remove('footer-hidden')
    el.cookieView.classList.remove('hidden')
    if (el.normalContent) el.normalContent.style.display = 'none'

    requestAnimationFrame(() => window.scrollTo({top: document.body.scrollHeight, behavior: 'auto'}))

    ProgrammaticScroll.create(CONSTANTS.SCROLL_MARK_DURATION)
    GlobalClose.bind()

    // Lazy setup handlers on first open
    if (!open.handlersSetup) {
      setupHandlers()
      open.handlersSetup = true
    }

    try {
      a11y?.trapFocus(el.cookieView)
    } catch (e) {
      // ignore
    }
  }

  const close = () => {
    const el = getElements()
    if (!el.footer) return

    el.cookieView?.classList.add('hidden')
    el.footer.classList.remove('footer-expanded')
    document.body.classList.remove('footer-expanded')
    el.footerMax?.classList.add('footer-hidden')
    el.footerMin?.classList.remove('footer-hidden')
    if (el.normalContent) el.normalContent.style.display = 'block'

    document.documentElement.style.removeProperty('scroll-snap-type')

    if (window.footerScrollHandler) {
      window.footerScrollHandler.expanded = false
    }
    GlobalClose.unbind()

    try {
      a11y?.releaseFocus()
    } catch (e) {
      // ignore
    }
  }

  return {open, close}
})()

GlobalClose.setCloseHandler(() => CookieSettings.close())

// ===== Theme System (Optimized & Compact) =====
class ThemeSystem {
  constructor() {
    this.currentTheme = this.getStoredTheme()
  }

  getStoredTheme() {
    return localStorage.getItem('preferred-theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
  }

  applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme)
    this.currentTheme = theme
    localStorage.setItem('preferred-theme', theme)
  }

  toggleTheme() {
    this.applyTheme(this.currentTheme === 'light' ? 'dark' : 'light')
  }

  init() {
    this.applyTheme(this.currentTheme)
    const toggle = domCache.get('#dayNightToggle')

    if (toggle) {
      toggle.addEventListener('click', () => {
        this.toggleTheme()
      })
    }
  }
}

// ===== Scroll Handler (Preserved Logic) =====
class ScrollHandler {
  constructor() {
    this.expanded = false
    this.observer = null
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

    this.observer = new IntersectionObserver(
      entries => {
        const entry = entries[0]
        if (entry.target.id !== 'footer-trigger-zone') return

        if (!entry.isIntersecting && ProgrammaticScroll.hasActive()) return

        const threshold = this.expanded ? 0.02 : 0.05
        const shouldExpand = entry.isIntersecting && entry.intersectionRatio >= threshold
        this.toggleExpansion(shouldExpand)
      },
      {rootMargin: '0px 0px -10% 0px', threshold: [0.02, 0.05]}
    )

    this.observer.observe(trigger)
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
      footer.classList.remove('footer-expanded')
      document.body.classList.remove('footer-expanded')
      max?.classList.add('footer-hidden')
      min?.classList.remove('footer-hidden')
      document.documentElement.style.removeProperty('scroll-snap-type')

      this.expanded = false
      GlobalClose.unbind()
    }
  }
}

// ===== Footer Loader =====
class FooterLoader {
  async init() {
    const container = domCache.get('#footer-container')
    if (!container) return false

    try {
      // Load Footer Content
      const srcBase = container.dataset.footerSrc || '/content/components/footer/footer'
      const isLocal = location.hostname === 'localhost' || location.hostname.startsWith('127.')
      const candidates = isLocal ? [srcBase + '.html', srcBase] : [srcBase, srcBase + '.html']

      let response
      for (const c of candidates) {
        try {
          response = await fetch(c)
          if (response.ok) break
        } catch { /* continue */ }
      }

      if (!response || !response.ok) throw new Error('Footer load failed')

      container.innerHTML = await response.text()
      domCache.invalidate()

      this.updateYears()
      this.setupInteractions()

      new ConsentBanner().init()
      new ThemeSystem().init()
      new ScrollHandler().init()

      // Footer Resizer (Simplified inline)
      const handleResize = () => {
         const content = domCache.get('.footer-enhanced-content')
         if (content) {
            const h = Math.min(Math.max(0, content.scrollHeight), window.innerHeight - 16)
            if (h > 0) document.documentElement.style.setProperty('--footer-actual-height', `${h}px`)
         }
      }
      window.addEventListener('resize', handleResize, {passive: true})
      handleResize()

      document.dispatchEvent(new CustomEvent('footer:loaded'))
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
      })
    }

    // Event Delegation
    document.addEventListener(
      'click',
      e => {
        const cookieTrigger = e.target.closest('[data-cookie-trigger]')
        if (cookieTrigger) {
          e.preventDefault()
          CookieSettings.open()
          return
        }
      },
      {passive: false}
    )
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
window.FooterSystem = {
  FooterLoader,
  CookieSettings,
  ProgrammaticScroll
}
