/* Accessibility Manager */

class AccessibilityManager {
  constructor() {
    this.focusTrapStack = [];
    this.lastFocusedElement = null;
    this.reducedMotionMQL = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    );
    this.highContrastMQL = window.matchMedia('(prefers-contrast: more)');
    this.reducedMotion = this.reducedMotionMQL.matches;
    this.highContrast = this.highContrastMQL.matches;
    this._initialized = false;
    this.init();
  }

  init() {
    if (this._initialized) return;

    try {
      this._onReducedMotionChange = (e) => {
        this.reducedMotion = e.matches;
        this.updateAnimations();
      };
      this.reducedMotionMQL.addEventListener(
        'change',
        this._onReducedMotionChange,
      );

      this._onHighContrastChange = (e) => {
        this.highContrast = e.matches;
        this.updateContrast();
      };
      this.highContrastMQL.addEventListener(
        'change',
        this._onHighContrastChange,
      );
    } catch {
      // Fallback for older browsers
      try {
        this._onReducedMotionChange = (e) => {
          this.reducedMotion = e.matches;
          this.updateAnimations();
        };
        this.reducedMotionMQL.addListener(this._onReducedMotionChange);

        this._onHighContrastChange = (e) => {
          this.highContrast = e.matches;
          this.updateContrast();
        };
        this.highContrastMQL.addListener(this._onHighContrastChange);
      } catch {
        // Ignore if not supported
      }
    }

    this.setupKeyboardNav();
    this.setupSkipLinks();
    this.updateAnimations();
    this.updateContrast();
    this._initialized = true;
  }

  destroy() {
    try {
      if (this._onReducedMotionChange) {
        if (this.reducedMotionMQL.removeEventListener)
          this.reducedMotionMQL.removeEventListener(
            'change',
            this._onReducedMotionChange,
          );
        else if (this.reducedMotionMQL.removeListener)
          this.reducedMotionMQL.removeListener(this._onReducedMotionChange);
        this._onReducedMotionChange = null;
      }
    } catch {
      // Ignore cleanup errors
    }
    try {
      if (this._onHighContrastChange) {
        if (this.highContrastMQL.removeEventListener)
          this.highContrastMQL.removeEventListener(
            'change',
            this._onHighContrastChange,
          );
        else if (this.highContrastMQL.removeListener)
          this.highContrastMQL.removeListener(this._onHighContrastChange);
        this._onHighContrastChange = null;
      }
    } catch {
      // Ignore cleanup errors
    }
    try {
      if (this._onKeyboardNav)
        document.removeEventListener('keydown', this._onKeyboardNav);
    } catch {
      // Ignore cleanup errors
    }
    try {
      if (this._skipRemovers && this._skipRemovers.length)
        this._skipRemovers.forEach((r) => r());
    } catch {
      // Ignore cleanup errors
    }
  }

  setupKeyboardNav() {
    this._onKeyboardNav = (e) => {
      if (e.key === 'Escape') {
        this.handleEscape();
      }

      if (e.key === 'Tab' && this.focusTrapStack.length > 0) {
        this.handleTabInTrap(e);
      }
    };
    document.addEventListener('keydown', this._onKeyboardNav);
  }

  setupSkipLinks() {
    const skipLinks = document.querySelectorAll('.skip-link');
    this._skipRemovers = [];
    skipLinks.forEach((link) => {
      const _onSkipClick = (e) => {
        e.preventDefault();
        const href = link.getAttribute('href');
        if (!href) return;
        const target = document.querySelector(href);
        if (!target) return;
        target.setAttribute('tabindex', '-1');
        target.focus();
        target.addEventListener(
          'blur',
          () => {
            try {
              target.removeAttribute('tabindex');
            } catch {
              /* ignored */
            }
          },
          { once: true },
        );
      };
      link.addEventListener('click', _onSkipClick);
      this._skipRemovers.push(() =>
        link.removeEventListener('click', _onSkipClick),
      );
    });
  }

  trapFocus(container) {
    if (!container) return;

    const focusableElements = container.querySelectorAll(
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
    );

    if (!focusableElements || focusableElements.length === 0) return;

    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];

    this.lastFocusedElement = document.activeElement;

    const trap = { container, firstFocusable, lastFocusable };
    this.focusTrapStack.push(trap);

    // Focus first focusable element
    try {
      firstFocusable.focus({ preventScroll: true });
    } catch {
      try {
        firstFocusable.focus();
      } catch {
        /* ignore */
      }
    }
  }

  releaseFocus() {
    const trap = this.focusTrapStack.pop();
    if (trap && this.lastFocusedElement) {
      try {
        this.lastFocusedElement.focus({ preventScroll: true });
      } catch {
        try {
          this.lastFocusedElement.focus();
        } catch {
          /* ignored */
        }
      }
    }
  }

  handleTabInTrap(e) {
    if (this.focusTrapStack.length === 0) return;
    const trap = this.focusTrapStack[this.focusTrapStack.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === trap.firstFocusable) {
        e.preventDefault();
        trap.lastFocusable.focus();
      }
    } else {
      if (document.activeElement === trap.lastFocusable) {
        e.preventDefault();
        trap.firstFocusable.focus();
      }
    }
  }

  handleEscape() {
    const cookieModal = document.querySelector(
      '.footer-cookie-settings:not(.hidden)',
    );
    if (cookieModal) {
      const closeBtn = cookieModal.querySelector('.cookie-settings-close');
      if (closeBtn) closeBtn.click();
      return;
    }

    const footer = document.getElementById('site-footer');
    if (footer && footer.classList.contains('footer-expanded')) {
      try {
        document.dispatchEvent(new CustomEvent('footer:requestClose'));
      } catch {
        // Ignore event dispatch errors
      }
    }
  }

  updateAnimations() {
    if (this.reducedMotion) {
      document.documentElement.style.setProperty('--transition-fast', '0s');
      document.documentElement.style.setProperty('--transition-base', '0s');
      document.documentElement.style.setProperty('--transition-smooth', '0s');
      document.documentElement.style.setProperty('--transition-slow', '0s');
    }
  }

  updateContrast() {
    if (this.highContrast) {
      document.body.classList.add('high-contrast');
    } else {
      document.body.classList.remove('high-contrast');
    }
  }

  announce(message, { priority = 'polite', clearPrevious = true } = {}) {
    if (!message) return;
    if (typeof window?.announce === 'function') {
      try {
        window.announce(message, { assertive: priority === 'assertive' });
        return;
      } catch {
        // Fallback to direct DOM manipulation
      }
    }

    const region =
      priority === 'assertive'
        ? document.getElementById('live-region-assertive')
        : document.getElementById('live-region-status');
    if (!region) return;

    if (clearPrevious) region.textContent = '';
    setTimeout(() => {
      try {
        region.textContent = message;
      } catch {
        // Ignore errors
      }
    }, 100);
  }
}

// Global instance
const a11y = new AccessibilityManager();
window.a11y = a11y;
export { a11y };

export function createAnnouncer() {
  const cache = new Map();

  return (message, { assertive = false, dedupe = false } = {}) => {
    if (!message) return;

    if (dedupe && cache.has(message)) return;
    if (dedupe) {
      cache.set(message, true);
      setTimeout(() => cache.delete(message), 3000);
    }

    try {
      const id = assertive ? 'live-region-assertive' : 'live-region-status';
      const region = document.getElementById(id);
      if (!region) return;

      region.textContent = '';
      requestAnimationFrame(() => {
        region.textContent = message;
      });
    } catch {
      // Ignore announcement errors
    }
  };
}
