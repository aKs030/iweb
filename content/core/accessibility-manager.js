/* Accessibility Manager */
import { closeActiveOverlay } from './overlay-manager.js';

/**
 * Attach a MediaQueryList change listener and return a cleanup function.
 *
 * @param {MediaQueryList} mql
 * @param {(event: MediaQueryListEvent) => void} handler
 * @returns {() => void}
 */
function bindMediaQueryChange(mql, handler) {
  if (
    !mql ||
    typeof handler !== 'function' ||
    typeof mql.addEventListener !== 'function'
  ) {
    return () => {};
  }

  try {
    mql.addEventListener('change', handler);
    return () => {
      try {
        mql.removeEventListener('change', handler);
      } catch {
        // ignore cleanup errors
      }
    };
  } catch {
    // ignore unsupported environments
  }

  return () => {};
}

class AccessibilityManager {
  constructor() {
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

    this._onReducedMotionChange = (e) => {
      this.reducedMotion = e.matches;
      this.updateAnimations();
    };
    this._removeReducedMotionListener = bindMediaQueryChange(
      this.reducedMotionMQL,
      this._onReducedMotionChange,
    );

    this._onHighContrastChange = (e) => {
      this.highContrast = e.matches;
      this.updateContrast();
    };
    this._removeHighContrastListener = bindMediaQueryChange(
      this.highContrastMQL,
      this._onHighContrastChange,
    );

    this.setupKeyboardNav();
    this.setupSkipLinks();
    this.updateAnimations();
    this.updateContrast();
    this._initialized = true;
  }

  destroy() {
    try {
      if (this._removeReducedMotionListener) {
        this._removeReducedMotionListener();
        this._removeReducedMotionListener = null;
      }
      if (this._onReducedMotionChange) {
        this._onReducedMotionChange = null;
      }
    } catch {
      // Ignore cleanup errors
    }
    try {
      if (this._removeHighContrastListener) {
        this._removeHighContrastListener();
        this._removeHighContrastListener = null;
      }
      if (this._onHighContrastChange) {
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
        const target = /** @type {HTMLElement} */ (
          document.querySelector(href)
        );
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

  async handleEscape() {
    const closedOverlay = await closeActiveOverlay({
      reason: 'escape',
      restoreFocus: true,
    });
    if (closedOverlay) return;

    const footerSr = document.querySelector('site-footer')?.shadowRoot;
    const cookieModal = (footerSr || document).querySelector(
      '#cookie-settings:not(.hidden)',
    );
    if (cookieModal) {
      const closeBtn = /** @type {HTMLElement} */ (
        cookieModal.querySelector('#close-settings')
      );
      if (closeBtn) closeBtn.click();
      return;
    }

    // prefer calling the footer API directly instead of firing events
    try {
      const { closeFooter } = await import('#footer/index.js');
      closeFooter();
    } catch {
      // footer module could not be imported
    }
  }

  updateAnimations() {
    if (this.reducedMotion) {
      document.documentElement.style.setProperty('--transition-fast', '0s');
      document.documentElement.style.setProperty('--transition-base', '0s');
      document.documentElement.style.setProperty('--transition-smooth', '0s');
      document.documentElement.style.setProperty('--transition-slow', '0s');
    } else {
      // Restore default transitions when preference changes back
      document.documentElement.style.removeProperty('--transition-fast');
      document.documentElement.style.removeProperty('--transition-base');
      document.documentElement.style.removeProperty('--transition-smooth');
      document.documentElement.style.removeProperty('--transition-slow');
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

// Global instance (guard for SSR / non-browser environments)
const a11y = typeof window !== 'undefined' ? new AccessibilityManager() : null;
if (typeof window !== 'undefined') /** @type {any} */ (window).a11y = a11y;
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
