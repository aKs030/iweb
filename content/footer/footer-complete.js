/**
 * Footer Complete System - Fully Optimized
 * @version 9.2.0
 * Changes:
 * - Removed duplicated CookieManager (now uses shared-utilities)
 * - Optimized event listeners
 */

import { createLogger, CookieManager } from '../shared-utilities.js';
import { a11y } from '../accessibility-manager.js';

const log = createLogger('FooterSystem');

// Tunable constants
const PROGRAMMATIC_SCROLL_MARK_DURATION = 1000;
const PROGRAMMATIC_SCROLL_WATCH_TIMEOUT = 5000;
const PROGRAMMATIC_SCROLL_WATCH_THRESHOLD = 6;
const PROGRAMMATIC_SCROLL_DEFAULT_DURATION = 600;

// ===== Programmatic Scroll Helper =====
const ProgrammaticScroll = (() => {
  let activeToken = null;
  let timer = null;
  const watchers = new Map();
  return {
    create(duration = PROGRAMMATIC_SCROLL_DEFAULT_DURATION) {
      try {
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
      } catch (e) {
        /* ignored */
      }
      const token = Symbol('progScroll');
      activeToken = token;
      if (duration > 0) {
        timer = setTimeout(() => {
          if (activeToken === token) activeToken = null;
          timer = null;
        }, duration);
      }
      return token;
    },
    clear(token) {
      if (!activeToken) return;
      if (!token || activeToken === token) {
        activeToken = null;
        try {
          if (timer) clearTimeout(timer);
          timer = null;
        } catch (e) {
          /* ignored */
        }

        if (watchers.has(token)) {
          const watcher = watchers.get(token);
          try {
            if (watcher.listener) window.removeEventListener('scroll', watcher.listener);
          } catch (e) {
            /* no-op */
          }
          try {
            if (watcher.observer) watcher.observer.disconnect();
          } catch (e) {
            /* no-op */
          }
          try {
            if (watcher.timeoutId) clearTimeout(watcher.timeoutId);
          } catch (e) {
            /* no-op */
          }
          watchers.delete(token);
        }
      }
    },
    hasActive() {
      return !!activeToken;
    },
    watchUntil(
      token,
      getTarget,
      timeout = PROGRAMMATIC_SCROLL_WATCH_TIMEOUT,
      threshold = PROGRAMMATIC_SCROLL_WATCH_THRESHOLD
    ) {
      if (!token) return;
      let finished = false;

      const resolve = () => {
        try {
          if (typeof getTarget === 'function') return getTarget();
          if (typeof getTarget === 'string') return document.querySelector(getTarget);
          return getTarget;
        } catch (e) {
          return null;
        }
      };

      const resolved = resolve();

      if (resolved instanceof Element && 'IntersectionObserver' in window) {
        const observer = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (finished) return;
              if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
                finished = true;
                ProgrammaticScroll.clear(token);
              }
            });
          },
          { root: null, threshold: [0.5, 0.75, 0.9, 1] }
        );

        observer.observe(resolved);

        const timeoutId = setTimeout(() => {
          if (!finished) ProgrammaticScroll.clear(token);
          observer.disconnect();
        }, timeout);

        watchers.set(token, { observer, timeoutId });
        return token;
      }

      // Fallback scroll listener logic
      const check = () => {
        try {
          const current = window.scrollY || window.pageYOffset || 0;
          const atBottom = window.innerHeight + current >= document.body.scrollHeight - threshold;
          if (atBottom) {
            finished = true;
            ProgrammaticScroll.clear(token);
          }
        } catch (e) {
          /* no-op */
        }
      };

      const listener = () => {
        if (!finished) check();
      };
      check();
      window.addEventListener('scroll', listener, { passive: true });
      const timeoutId = setTimeout(() => {
        if (!finished) ProgrammaticScroll.clear(token);
      }, timeout);

      watchers.set(token, { listener, timeoutId });
      return token;
    }
  };
})();

// ===== Global Close Handlers =====
const GlobalClose = (() => {
  let closeHandler = null;
  let bound = false;

  const onDocClick = (e) => {
    const footer = document.getElementById('site-footer');
    if (!footer || !footer.classList.contains('footer-expanded')) return;
    if (e.target.closest && e.target.closest('#site-footer')) return;
    if (typeof closeHandler === 'function') closeHandler();
  };

  const onUserScroll = () => {
    if (ProgrammaticScroll.hasActive()) return;
    const footer = document.getElementById('site-footer');
    if (!footer || !footer.classList.contains('footer-expanded')) return;
    if (typeof closeHandler === 'function') closeHandler();
  };

  return {
    setCloseHandler(fn) {
      closeHandler = fn;
    },
    bind() {
      if (bound) return;
      document.addEventListener('click', onDocClick, true);
      window.addEventListener('wheel', onUserScroll, { passive: true });
      window.addEventListener('touchstart', onUserScroll, { passive: true });
      bound = true;
    },
    unbind() {
      if (!bound) return;
      document.removeEventListener('click', onDocClick, true);
      window.removeEventListener('wheel', onUserScroll);
      window.removeEventListener('touchstart', onUserScroll);
      bound = false;
    }
  };
})();

// ===== Analytics =====
const GoogleAnalytics = {
  load() {
    const blockedScripts = document.querySelectorAll('script[data-consent="required"]');
    if (blockedScripts.length === 0) return;

    blockedScripts.forEach((script) => {
      const newScript = document.createElement('script');
      Array.from(script.attributes).forEach((attr) => {
        if (attr.name === 'data-src') newScript.setAttribute('src', attr.value);
        else if (attr.name !== 'data-consent' && attr.name !== 'type')
          newScript.setAttribute(attr.name, attr.value);
      });
      if (script.innerHTML.trim()) newScript.innerHTML = script.innerHTML;
      script.parentNode.replaceChild(newScript, script);
    });
    log.info('Google Analytics loaded');
  }
};

// ===== Consent Banner =====
class ConsentBanner {
  constructor() {
    this.banner = document.getElementById('cookie-consent-banner');
    this.acceptBtn = document.getElementById('accept-cookies-btn');
    this.rejectBtn = document.getElementById('reject-cookies-btn');
  }

  init() {
    if (!this.banner || !this.acceptBtn) return;

    const consent = CookieManager.get('cookie_consent');
    if (consent === 'accepted') {
      GoogleAnalytics.load();
      this.banner.classList.add('hidden');
    } else if (consent === 'rejected') {
      this.banner.classList.add('hidden');
    } else {
      this.banner.classList.remove('hidden');
    }

    this.acceptBtn.addEventListener('click', () => {
      this.banner.classList.add('hidden');
      CookieManager.set('cookie_consent', 'accepted');
      GoogleAnalytics.load();
    });

    if (this.rejectBtn) {
      this.rejectBtn.addEventListener('click', () => {
        this.banner.classList.add('hidden');
        CookieManager.set('cookie_consent', 'rejected');
      });
    }
  }
}

// ===== Cookie Settings =====
const CookieSettings = (() => {
  let boundHandlers = new WeakMap();

  function getElements() {
    return {
      footer: document.getElementById('site-footer'),
      footerMin: document.querySelector('.footer-minimized'),
      footerMax: document.querySelector('.footer-maximized'),
      cookieView: document.getElementById('footer-cookie-view'),
      normalContent: document.getElementById('footer-normal-content'),
      analyticsToggle: document.getElementById('footer-analytics-toggle'),
      closeBtn: document.getElementById('close-cookie-footer'),
      rejectAllBtn: document.getElementById('footer-reject-all'),
      acceptSelectedBtn: document.getElementById('footer-accept-selected'),
      acceptAllBtn: document.getElementById('footer-accept-all')
    };
  }

  function setupButtonHandlers(elements) {
    const handlers = {
      closeBtn: () => close(),
      rejectAllBtn: () => {
        CookieManager.set('cookie_consent', 'rejected');
        CookieManager.deleteAnalytics();
        close();
        document.getElementById('cookie-consent-banner')?.classList.add('hidden');
      },
      acceptSelectedBtn: () => {
        if (elements.analyticsToggle?.checked) {
          CookieManager.set('cookie_consent', 'accepted');
          GoogleAnalytics.load();
        } else {
          CookieManager.set('cookie_consent', 'rejected');
          CookieManager.deleteAnalytics();
        }
        close();
        document.getElementById('cookie-consent-banner')?.classList.add('hidden');
      },
      acceptAllBtn: () => {
        CookieManager.set('cookie_consent', 'accepted');
        GoogleAnalytics.load();
        close();
        document.getElementById('cookie-consent-banner')?.classList.add('hidden');
      }
    };

    Object.entries(handlers).forEach(([key, handler]) => {
      const element = elements[key];
      if (element && !boundHandlers.has(element)) {
        element.addEventListener('click', handler);
        boundHandlers.set(element, handler);
      }
    });
  }

  function open() {
    const elements = getElements();
    if (!elements.footer || !elements.cookieView) return;

    const consent = CookieManager.get('cookie_consent');
    if (elements.analyticsToggle) elements.analyticsToggle.checked = consent === 'accepted';

    // Temporarily disable scroll snapping to prevent layout fighting
    document.documentElement.style.scrollSnapType = 'none';

    elements.footer.classList.add('footer-expanded');
    document.body.classList.add('footer-expanded');
    elements.footerMin?.classList.add('footer-hidden');
    elements.footerMax?.classList.remove('footer-hidden');
    elements.cookieView.classList.remove('hidden');
    if (elements.normalContent) elements.normalContent.style.display = 'none';

    requestAnimationFrame(() =>
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'auto' })
    );

    ProgrammaticScroll.create(PROGRAMMATIC_SCROLL_MARK_DURATION);
    GlobalClose.bind();
    setupButtonHandlers(elements);

    // Focus management
    try {
      a11y?.trapFocus(elements.cookieView);
    } catch (e) {
      /* ignored */
    }
  }

  function close() {
    const elements = getElements();
    if (!elements.footer) return;

    elements.cookieView?.classList.add('hidden');
    elements.footer.classList.remove('footer-expanded');
    document.body.classList.remove('footer-expanded');
    elements.footerMax?.classList.add('footer-hidden');
    elements.footerMin?.classList.remove('footer-hidden');
    if (elements.normalContent) elements.normalContent.style.display = 'block';

    // Restore scroll snapping
    document.documentElement.style.removeProperty('scroll-snap-type');

    if (window.footerScrollHandler) window.footerScrollHandler.expanded = false;
    GlobalClose.unbind();

    try {
      a11y?.releaseFocus();
    } catch (e) {
      /* ignored */
    }
  }
  return { open, close };
})();

// Global close glue
GlobalClose.setCloseHandler(() => CookieSettings.close());

// ===== Theme System =====
class ThemeSystem {
  constructor() {
    this.currentTheme =
      localStorage.getItem('preferred-theme') ||
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  }

  applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    this.currentTheme = theme;
    localStorage.setItem('preferred-theme', theme);
  }

  toggleTheme() {
    this.applyTheme(this.currentTheme === 'light' ? 'dark' : 'light');
  }

  createRipple(button, x, y) {
    const ripple = document.createElement('div');
    ripple.className = 'artwork-ripple';
    ripple.style.left = `${x}px`;
    ripple.style.top = `${y}px`;
    button.appendChild(ripple);
    setTimeout(() => ripple.remove(), 800);
  }

  init() {
    this.applyTheme(this.currentTheme);
    const toggle = document.getElementById('dayNightToggle');
    if (toggle) {
      toggle.addEventListener('click', (e) => {
        const rect = toggle.getBoundingClientRect();
        this.createRipple(toggle, e.clientX - rect.left, e.clientY - rect.top);
        this.toggleTheme();
      });
    }
  }
}

// ===== Footer Loader =====
class FooterLoader {
  async init() {
    const container = document.getElementById('footer-container');
    if (!container) return false;

    try {
      const src = container.dataset.footerSrc || '/content/footer/footer.html';
      const response = await fetch(src);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      container.innerHTML = await response.text();

      this.updateYears();
      this.setupInteractions();

      new ConsentBanner().init();
      new ThemeSystem().init();
      new ScrollHandler().init();
      new FooterResizer().init();

      document.dispatchEvent(
        new CustomEvent('footer:loaded', { detail: { footerId: 'site-footer' } })
      );
      return true;
    } catch (error) {
      log.error('Footer load failed', error);
      return false;
    }
  }

  updateYears() {
    const year = new Date().getFullYear();
    document.querySelectorAll('.current-year').forEach((el) => (el.textContent = year));
  }

  setupInteractions() {
    // Newsletter
    const form = document.querySelector('.newsletter-form-enhanced');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const btn = form.querySelector('button[type="submit"]');
        if (btn) {
          const old = btn.textContent;
          btn.textContent = '✓';
          btn.disabled = true;
          setTimeout(() => {
            btn.textContent = old;
            btn.disabled = false;
          }, 3000);
        }
        form.reset();
      });
    }

    // Cookie Triggers
    document.querySelectorAll('[data-cookie-trigger]').forEach((trigger) => {
      trigger.addEventListener('click', (e) => {
        if (trigger.tagName === 'A' && (!trigger.href || trigger.href.startsWith('#')))
          e.preventDefault();
        CookieSettings.open();
      });
    });

    // Footer Toggle Triggers
    document.querySelectorAll('[data-footer-trigger]').forEach((trigger) => {
      trigger.addEventListener('click', (e) => {
        if (trigger.tagName === 'A' && (!trigger.href || trigger.href.startsWith('#')))
          e.preventDefault();
        if (window.footerScrollHandler) {
          window.footerScrollHandler.toggleExpansion(true);
        } else {
          // Fallback logic
          const footer = document.getElementById('site-footer');
          if (footer) {
            // Force snap disable here too for consistency
            document.documentElement.style.scrollSnapType = 'none';

            footer.classList.add('footer-expanded');
            document.body.classList.add('footer-expanded');
            footer.querySelector('.footer-minimized')?.classList.add('footer-hidden');
            footer.querySelector('.footer-maximized')?.classList.remove('footer-hidden');
            const token = ProgrammaticScroll.create();
            window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
            ProgrammaticScroll.watchUntil(token, '.footer-maximized-viewport');
          }
        }
      });
    });
  }
}

// ===== Scroll Handler =====
class ScrollHandler {
  constructor() {
    this.expanded = false;
    this.observer = null;
    window.footerScrollHandler = this;
  }

  init() {
    const footer = document.getElementById('site-footer');
    const trigger = document.getElementById('footer-trigger-zone');

    // Ensure visibility state on init
    if (footer) {
      footer.querySelector('.footer-minimized')?.classList.remove('footer-hidden');
      footer.querySelector('.footer-maximized')?.classList.add('footer-hidden');
    }

    if (!footer || !trigger) return;

    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.target.id === 'footer-trigger-zone') {
            // If scrolling programmatically, ignore boundary checks
            if (!entry.isIntersecting && ProgrammaticScroll.hasActive()) return;

            const threshold = this.expanded ? 0.02 : 0.05;
            const shouldExpand = entry.isIntersecting && entry.intersectionRatio >= threshold;
            this.toggleExpansion(shouldExpand);
          }
        });
      },
      { rootMargin: '0px 0px -10% 0px', threshold: [0, 0.02, 0.05, 0.1, 0.5, 1] }
    );

    this.observer.observe(trigger);
  }

  toggleExpansion(shouldExpand) {
    const footer = document.getElementById('site-footer');
    if (!footer) return;

    const min = footer.querySelector('.footer-minimized');
    const max = footer.querySelector('.footer-maximized');

    if (shouldExpand && !this.expanded) {
      ProgrammaticScroll.create(1000);
      GlobalClose.bind();

      // CRITICAL FIX: Temporarily disable scroll snapping on HTML/Body
      document.documentElement.style.scrollSnapType = 'none';

      footer.classList.add('footer-expanded');
      document.body.classList.add('footer-expanded');
      max?.classList.remove('footer-hidden');
      min?.classList.add('footer-hidden');

      this.expanded = true;
    } else if (!shouldExpand && this.expanded) {
      footer.classList.remove('footer-expanded');
      document.body.classList.remove('footer-expanded');
      max?.classList.add('footer-hidden');
      min?.classList.remove('footer-hidden');

      // Restore scroll snapping behavior
      document.documentElement.style.removeProperty('scroll-snap-type');

      this.expanded = false;
      GlobalClose.unbind();
    }
  }

  cleanup() {
    this.observer?.disconnect();
  }
}

// ===== Footer Resizer =====
class FooterResizer {
  init() {
    this.apply = this.apply.bind(this);
    window.addEventListener('resize', this.apply, { passive: true });
    this.apply();
  }

  apply() {
    const content = document.querySelector('#site-footer .footer-enhanced-content');
    if (!content) return;

    const height = Math.min(Math.max(0, content.scrollHeight), window.innerHeight - 24);

    if (height > 0) {
      document.documentElement.style.setProperty('--footer-actual-height', `${height}px`);
    }
  }

  cleanup() {
    window.removeEventListener('resize', this.apply);
  }
}

// ===== Auto-Start =====
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new FooterLoader().init(), { once: true });
} else {
  new FooterLoader().init();
}

window.FooterSystem = { FooterLoader, CookieSettings };
