/* Accessibility Manager
 * Manages focus traps, prefers-reduced-motion / prefers-contrast and announcements for a11y
 */

class AccessibilityManager {
  constructor() {
    this.focusTrapStack = []
    this.lastFocusedElement = null
    // resolve MQLs safely
    this.reducedMotionMQL = window.matchMedia('(prefers-reduced-motion: reduce)')
    this.highContrastMQL = window.matchMedia('(prefers-contrast: more)')
    this.reducedMotion = this.reducedMotionMQL.matches
    this.highContrast = this.highContrastMQL.matches

    // Delay calling init so the user of this module can call init centrally if desired.
    // The constructor still calls init to maintain previous behavior, but init is guarded.
    this._initialized = false
    this.init()
  }

  init() {
    if (this._initialized) return // make idempotent, safe to call multiple times

    // Listen for preference changes (modern browsers support addEventListener on MediaQueryList)
    try {
      this.reducedMotionMQL.addEventListener('change', e => {
        this.reducedMotion = e.matches
        this.updateAnimations()
      })
      this.highContrastMQL.addEventListener('change', e => {
        this.highContrast = e.matches
        this.updateContrast()
      })
    } catch (e) {
      // Fallback for older browsers
      try {
        this.reducedMotionMQL.addListener(e => {
          this.reducedMotion = e.matches
          this.updateAnimations()
        })
        this.highContrastMQL.addListener(e => {
          this.highContrast = e.matches
          this.updateContrast()
        })
      } catch (e) {
        /* ignored */
      }
    }

    // Setup keyboard navigation and skip links
    this.setupKeyboardNav()
    this.setupSkipLinks()

    // Ensure initial state
    this.updateAnimations()
    this.updateContrast()
    this._initialized = true
  }

  setupKeyboardNav() {
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        this.handleEscape()
      }

      if (e.key === 'Tab' && this.focusTrapStack.length > 0) {
        this.handleTabInTrap(e)
      }
    })
  }

  setupSkipLinks() {
    const skipLinks = document.querySelectorAll('.skip-link')
    skipLinks.forEach(link => {
      link.addEventListener('click', e => {
        e.preventDefault()
        const href = link.getAttribute('href')
        if (!href) return
        const target = document.querySelector(href)
        if (!target) return
        target.setAttribute('tabindex', '-1')
        target.focus()
        target.addEventListener(
          'blur',
          () => {
            try {
              target.removeAttribute('tabindex')
            } catch (e) {
              /* ignored */
            }
          },
          {once: true}
        )
      })
    })
  }

  trapFocus(container) {
    if (!container) return

    const focusableElements = container.querySelectorAll(
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
    )

    if (!focusableElements || focusableElements.length === 0) return

    const firstFocusable = focusableElements[0]
    const lastFocusable = focusableElements[focusableElements.length - 1]

    this.lastFocusedElement = document.activeElement

    const trap = {container, firstFocusable, lastFocusable}
    this.focusTrapStack.push(trap)

    // Focus first focusable element
    try {
      firstFocusable.focus({preventScroll: true})
    } catch (e) {
      try {
        firstFocusable.focus()
      } catch (e) {
        /* ignore */
      }
    }
  }

  releaseFocus() {
    const trap = this.focusTrapStack.pop()
    if (trap && this.lastFocusedElement) {
      try {
        this.lastFocusedElement.focus({preventScroll: true})
      } catch (e) {
        try {
          this.lastFocusedElement.focus()
        } catch (e) {
          /* ignored */
        }
      }
    }
  }

  handleTabInTrap(e) {
    if (this.focusTrapStack.length === 0) return
    const trap = this.focusTrapStack[this.focusTrapStack.length - 1]

    if (e.shiftKey) {
      if (document.activeElement === trap.firstFocusable) {
        e.preventDefault()
        trap.lastFocusable.focus()
      }
    } else {
      if (document.activeElement === trap.lastFocusable) {
        e.preventDefault()
        trap.firstFocusable.focus()
      }
    }
  }

  handleEscape() {
    // Close cookie modal
    const cookieModal = document.querySelector('.footer-cookie-settings:not(.hidden)')
    if (cookieModal) {
      const closeBtn = cookieModal.querySelector('.cookie-settings-close')
      if (closeBtn) closeBtn.click()
      return
    }

    // Close expanded footer
    const footer = document.getElementById('site-footer')
    if (footer && footer.classList.contains('footer-expanded')) {
      if (window.CookieSettings && typeof window.CookieSettings.close === 'function') {
        window.CookieSettings.close()
      }
    }
  }

  updateAnimations() {
    if (this.reducedMotion) {
      document.documentElement.style.setProperty('--transition-fast', '0s')
      document.documentElement.style.setProperty('--transition-base', '0s')
      document.documentElement.style.setProperty('--transition-smooth', '0s')
      document.documentElement.style.setProperty('--transition-slow', '0s')
    } else {
      // Reset if not reduced motion — values come from CSS variables; this is a no-op here
    }
  }

  updateContrast() {
    if (this.highContrast) {
      document.body.classList.add('high-contrast')
    } else {
      document.body.classList.remove('high-contrast')
    }
  }

  // Announce method — accepts priority: 'polite' | 'assertive'
  announce(message, {priority = 'polite', clearPrevious = true} = {}) {
    if (!message) return
    // If a global announce helper exists, prefer it (keeps dedupe/assertive behaviours centralized)
    if (typeof window?.announce === 'function') {
      try {
        window.announce(message, {assertive: priority === 'assertive'})
        return
      } catch (e) {
        /* continue fallback */
      }
    }

    const region =
      priority === 'assertive' ? document.getElementById('live-region-assertive') : document.getElementById('live-region-status')
    if (!region) return

    if (clearPrevious) {
      region.textContent = ''
    }
    // small delay for screen reader compatibility
    setTimeout(() => {
      try {
        region.textContent = message
      } catch (e) {
        /* ignored */
      }
    }, 100)
  }
}

// Global instance
const a11y = new AccessibilityManager()
window.a11y = a11y
export {AccessibilityManager, a11y}
