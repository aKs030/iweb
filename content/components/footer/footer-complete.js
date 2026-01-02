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
  ({ createLogger, CookieManager } = await import('../../utils/shared-utilities.js').catch(() => {
    throw new Error('Utils missing');
  }));
  ({ a11y } = await import('../../utils/accessibility-manager.js').catch(() => {
    throw new Error('A11y missing');
  }));
} catch {
  // Fallback Mocks, falls Dateien fehlen oder Pfade anders sind
  createLogger = () => ({
    info: console.warn,
    warn: console.warn,
    error: console.error,
  });
  CookieManager = {
    get: (k) => localStorage.getItem(k),
    set: (k, v) => localStorage.setItem(k, v),
    deleteAnalytics: () => console.warn('Analytics deleted (Mock)'),
  };
  a11y = {
    announce: (msg) => console.warn(`[A11y]: ${msg}`),
    trapFocus: () => {},
    releaseFocus: () => {},
  };
}

const log = createLogger('FooterSystem');

// ===== Utilities =====
const debounce = (func, wait) => {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

const memoize = (fn) => {
  const cache = new Map();
  return (...args) => {
    const key = JSON.stringify(args);
    if (cache.has(key)) return cache.get(key);
    const result = fn(...args);
    cache.set(key, result);
    return result;
  };
};

// ===== Constants =====
const CONSTANTS = {
  SCROLL_MARK_DURATION: 1000,
  SCROLL_WATCH_TIMEOUT: 5000,
  SCROLL_THRESHOLD: 6,
  RESIZE_DEBOUNCE: 150,
  ANIMATION_DURATION: 800,
  // Keep the footer expanded for at least this many ms after first expand to avoid flapping
  // This is a fallback value; per-device defaults are applied when available.
  EXPAND_LOCK_MS: 1000,
  // Debounce collapse: wait this many ms before actually collapsing
  COLLAPSE_DEBOUNCE_MS: 250,
};

// ===== DOM Cache =====
class DOMCache {
  constructor() {
    this.cache = new Map();
  }

  get(selector, parent = document) {
    const key = `${selector}-${parent === document ? 'doc' : 'parent'}`;
    if (!this.cache.has(key)) {
      this.cache.set(key, parent.querySelector(selector));
    }
    return this.cache.get(key);
  }

  getAll(selector, parent = document) {
    const key = `all-${selector}`;
    if (!this.cache.has(key)) {
      this.cache.set(key, Array.from(parent.querySelectorAll(selector)));
    }
    return this.cache.get(key);
  }

  invalidate(selector) {
    if (selector) {
      this.cache.delete(selector);
      // Auch alle Varianten löschen (doc/parent)
      for (const key of this.cache.keys()) {
        if (key.startsWith(selector)) this.cache.delete(key);
      }
    } else {
      this.cache.clear();
    }
  }
}

const domCache = new DOMCache();

// ===== Programmatic Scroll (Optimized) =====
const ProgrammaticScroll = (() => {
  let activeToken = null;
  let timer = null;
  const watchers = new Map();

  return {
    create(duration = CONSTANTS.SCROLL_MARK_DURATION) {
      if (timer) clearTimeout(timer);

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
      if (!activeToken || (token && activeToken !== token)) return;

      activeToken = null;
      if (timer) clearTimeout(timer);
      timer = null;

      if (watchers.has(token)) {
        const watcher = watchers.get(token);
        watcher.observer?.disconnect();
        if (watcher.listener) {
          globalThis.removeEventListener('scroll', watcher.listener);
        }
        if (watcher.timeoutId) clearTimeout(watcher.timeoutId);
        watchers.delete(token);
      }
    },

    hasActive: () => !!activeToken,

    watchUntil(token, target, timeout = CONSTANTS.SCROLL_WATCH_TIMEOUT) {
      if (!token) return;

      const element = typeof target === 'string' ? domCache.get(target) : target;

      if (element && 'IntersectionObserver' in globalThis) {
        const observer = new IntersectionObserver(
          (entries) => {
            const entry = entries[0];
            if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
              ProgrammaticScroll.clear(token);
            }
          },
          { threshold: [0.5, 1] }
        );

        observer.observe(element);
        const timeoutId = setTimeout(() => {
          ProgrammaticScroll.clear(token);
          observer.disconnect();
        }, timeout);

        watchers.set(token, { observer, timeoutId });
        return token;
      }

      // Fallback
      const check = () => {
        const current = globalThis.scrollY || globalThis.pageYOffset;
        const atBottom =
          (globalThis.innerHeight || 0) + current >=
          document.body.scrollHeight - CONSTANTS.SCROLL_THRESHOLD;
        if (atBottom) ProgrammaticScroll.clear(token);
      };

      const listener = () => check();
      check();
      globalThis.addEventListener('scroll', listener, { passive: true });

      const timeoutId = setTimeout(() => ProgrammaticScroll.clear(token), timeout);
      watchers.set(token, { listener, timeoutId });
      return token;
    },
  };
})();

// ===== Global Close Handlers (Optimized) =====
const GlobalClose = (() => {
  let closeHandler = null;
  let bound = false;

  const onDocClick = (e) => {
    const footer = domCache.get('#site-footer');
    if (!footer?.classList.contains('footer-expanded')) return;
    // Ignore clicks inside the footer
    if (e.target.closest('#site-footer')) return;
    closeHandler?.();
  };

  const onUserScroll = () => {
    if (ProgrammaticScroll.hasActive()) return;
    const footer = domCache.get('#site-footer');
    if (!footer?.classList.contains('footer-expanded')) return;
    closeHandler?.();
  };

  return {
    setCloseHandler: (fn) => (closeHandler = fn),

    bind() {
      if (bound) return;

      const isMobile = globalThis.matchMedia?.('(max-width: 768px)')?.matches;

      if (isMobile) {
        // Mobile: only close on actual scroll movement
        globalThis.addEventListener('scroll', onUserScroll, { passive: true });
        globalThis.addEventListener('touchmove', onUserScroll, {
          passive: true,
        });
      } else {
        document.addEventListener('click', onDocClick, {
          capture: true,
          passive: true,
        });
        globalThis.addEventListener('wheel', onUserScroll, { passive: true });
        globalThis.addEventListener('touchstart', onUserScroll, {
          passive: true,
        });
      }

      bound = true;
    },

    unbind() {
      if (!bound) return;
      document.removeEventListener('click', onDocClick, true);
      globalThis.removeEventListener('wheel', onUserScroll);
      globalThis.removeEventListener('touchstart', onUserScroll);
      globalThis.removeEventListener('scroll', onUserScroll);
      globalThis.removeEventListener('touchmove', onUserScroll);
      bound = false;
    },
  };
})();

// ===== Analytics =====
const GoogleAnalytics = {
  load() {
    performance.mark('analytics-load-start');

    const blockedScripts = document.querySelectorAll('script[data-consent="required"]');
    if (blockedScripts.length === 0) return;

    blockedScripts.forEach((script) => {
      const newScript = document.createElement('script');
      Array.from(script.attributes).forEach((attr) => {
        if (attr.name === 'data-src') {
          newScript.setAttribute('src', attr.value);
        } else if (!['data-consent', 'type'].includes(attr.name)) {
          newScript.setAttribute(attr.name, attr.value);
        }
      });
      if (script.innerHTML.trim()) newScript.innerHTML = script.innerHTML;
      script.parentNode.replaceChild(newScript, script);
    });

    performance.mark('analytics-load-end');
    performance.measure('analytics-load', 'analytics-load-start', 'analytics-load-end');
    log.info('Google Analytics loaded');
  },
};

// Helper: update gtag consent state safely
function updateGtagConsent(input = true) {
  try {
    if (typeof gtag !== 'function') return;

    // Support boolean or object input for flexibility
    let payload = {};
    if (typeof input === 'boolean') {
      const v = input ? 'granted' : 'denied';
      payload = {
        ad_storage: v,
        analytics_storage: v,
        ad_user_data: v,
        ad_personalization: v,
      };
    } else if (input && typeof input === 'object') {
      // Allow partial overrides
      const granted = input.granted === true;
      const defaultV = granted ? 'granted' : 'denied';
      payload = {
        ad_storage: input.ad_storage || defaultV,
        analytics_storage: input.analytics_storage || defaultV,
        ad_user_data: input.ad_user_data || defaultV,
        ad_personalization: input.ad_personalization || defaultV,
      };
    }

    gtag('consent', 'update', payload);
  } catch (e) {
    /* ignore */
  }
}

// ===== Consent Banner (Optimized) =====
class ConsentBanner {
  constructor() {
    this.elements = {
      banner: domCache.get('#cookie-consent-banner'),
      acceptBtn: domCache.get('#accept-cookies-btn'),
      rejectBtn: domCache.get('#reject-cookies-btn'),
    };
  }

  init() {
    const { banner, acceptBtn, rejectBtn } = this.elements;
    if (!banner || !acceptBtn) return;

    const consent = CookieManager.get('cookie_consent');

    if (consent === 'accepted') {
      // ensure gtag consent state is set for already-accepted users
      updateGtagConsent(true);
      GoogleAnalytics.load();
      banner.classList.add('hidden');
    } else if (consent === 'rejected') {
      updateGtagConsent(false);
      banner.classList.add('hidden');
    } else {
      banner.classList.remove('hidden');
    }

    // Event Listeners
    acceptBtn.addEventListener('click', () => this.accept(), { once: false });
    rejectBtn?.addEventListener('click', () => this.reject(), { once: false });
  }

  accept() {
    this.elements.banner.classList.add('hidden');
    CookieManager.set('cookie_consent', 'accepted');

    globalThis.dataLayer = globalThis.dataLayer || [];
    globalThis.dataLayer.push({ event: 'consentGranted' });

    // Update gtag consent immediately and load analytics
    updateGtagConsent(true);
    GoogleAnalytics.load();
    try {
      a11y?.announce('Cookie-Präferenz: Alle Cookies akzeptiert', {
        priority: 'polite',
      });
    } catch {}
  }

  reject() {
    this.elements.banner.classList.add('hidden');
    CookieManager.set('cookie_consent', 'rejected');
    try {
      a11y?.announce('Cookie-Präferenz: Nur notwendige Cookies akzeptiert', {
        priority: 'polite',
      });
    } catch {}
  }
}

// ===== Cookie Settings (Optimized) =====
const CookieSettings = (() => {
  let elements = null;
  const handlers = new Map();

  const getElements = memoize(() => ({
    footer: domCache.get('#site-footer'),
    footerMin: domCache.get('.footer-minimized'),
    footerMax: domCache.get('.footer-maximized'),
    cookieView: domCache.get('#footer-cookie-view'),
    normalContent: domCache.get('#footer-normal-content'),
    analyticsToggle: domCache.get('#footer-analytics-toggle'),
    adPersonalizationToggle: domCache.get('#footer-ad-personalization-toggle'),
    closeBtn: domCache.get('#close-cookie-footer'),
    rejectAllBtn: domCache.get('#footer-reject-all'),
    acceptSelectedBtn: domCache.get('#footer-accept-selected'),
    acceptAllBtn: domCache.get('#footer-accept-all'),
    triggerBtn: domCache.get('#footer-cookies-link'), // Für aria-expanded
  }));

  const setupHandlers = (elements) => {
    const handlerMap = {
      closeBtn: () => close(),
      rejectAllBtn: () => {
        CookieManager.set('cookie_consent', 'rejected');
        CookieManager.set(
          'cookie_consent_detail',
          JSON.stringify({ analytics: false, ad_personalization: false })
        );
        CookieManager.deleteAnalytics();
        updateGtagConsent(false);
        try {
          a11y?.announce('Cookie-Einstellungen: Nur notwendige Cookies aktiv', {
            priority: 'polite',
          });
        } catch {}
        close();
        domCache.get('#cookie-consent-banner')?.classList.add('hidden');
      },
      acceptSelectedBtn: () => {
        const analyticsEnabled = !!elements.analyticsToggle?.checked;
        const adPersonalizationEnabled = !!elements.adPersonalizationToggle?.checked;

        // Persist an explicit detail object for granular consent
        const detail = {
          analytics: analyticsEnabled,
          ad_personalization: adPersonalizationEnabled,
        };

        CookieManager.set('cookie_consent_detail', JSON.stringify(detail));
        // Set an overall cookie_consent value (accepted if any optional cookie enabled)
        CookieManager.set(
          'cookie_consent',
          analyticsEnabled || adPersonalizationEnabled ? 'accepted' : 'rejected'
        );

        globalThis.dataLayer = globalThis.dataLayer || [];
        globalThis.dataLayer.push({ event: 'consentGranted', detail });

        // Update gtag consent with granular values
        updateGtagConsent({
          analytics_storage: analyticsEnabled ? 'granted' : 'denied',
          ad_storage: adPersonalizationEnabled ? 'granted' : 'denied',
          ad_user_data: adPersonalizationEnabled ? 'granted' : 'denied',
          ad_personalization: adPersonalizationEnabled ? 'granted' : 'denied',
        });

        if (analyticsEnabled) {
          GoogleAnalytics.load();
        } else {
          CookieManager.deleteAnalytics();
        }

        try {
          a11y?.announce(
            analyticsEnabled
              ? 'Cookie-Einstellungen gespeichert: Analyse aktiviert'
              : 'Cookie-Einstellungen gespeichert: Analyse deaktiviert',
            { priority: 'polite' }
          );
        } catch {}
        close();
        domCache.get('#cookie-consent-banner')?.classList.add('hidden');
      },
      acceptAllBtn: () => {
        CookieManager.set('cookie_consent', 'accepted');
        CookieManager.set(
          'cookie_consent_detail',
          JSON.stringify({ analytics: true, ad_personalization: true })
        );

        globalThis.dataLayer = globalThis.dataLayer || [];
        globalThis.dataLayer.push({
          event: 'consentGranted',
          detail: { analytics: true, ad_personalization: true },
        });

        updateGtagConsent({
          analytics_storage: 'granted',
          ad_storage: 'granted',
          ad_user_data: 'granted',
          ad_personalization: 'granted',
        });
        GoogleAnalytics.load();
        try {
          a11y?.announce('Cookie-Einstellungen: Alle Cookies aktiviert', {
            priority: 'polite',
          });
        } catch {}
        close();
        domCache.get('#cookie-consent-banner')?.classList.add('hidden');
      },
    };

    Object.entries(handlerMap).forEach(([key, handler]) => {
      const element = elements[key];
      if (element && !handlers.has(element)) {
        element.addEventListener('click', handler);
        handlers.set(element, handler);
      }
    });

    const removeHandlers = () => {
      handlers.forEach((handler, el) => {
        try {
          el.removeEventListener('click', handler);
        } catch {}
      });
      handlers.clear();
    };

    // Attach cleanup to cookieView so closeFooter can access it
    if (elements.cookieView) elements.cookieView._removeHandlers = removeHandlers;
  };

  const open = () => {
    performance.mark('cookie-settings-open-start');
    elements = getElements();
    if (!elements.footer || !elements.cookieView) return;

    const consent = CookieManager.get('cookie_consent');
    if (elements.analyticsToggle) {
      elements.analyticsToggle.checked = consent === 'accepted';
    }

    document.documentElement.style.scrollSnapType = 'none';

    elements.footer.classList.add('footer-expanded');
    document.body.classList.add('footer-expanded');
    elements.footerMin?.classList.add('footer-hidden');
    elements.footerMax?.classList.remove('footer-hidden');
    elements.cookieView.classList.remove('hidden');
    if (elements.normalContent) elements.normalContent.style.display = 'none';

    // Accessibility Update
    if (elements.triggerBtn) elements.triggerBtn.setAttribute('aria-expanded', 'true');

    requestAnimationFrame(() =>
      globalThis.scrollTo({ top: document.body.scrollHeight, behavior: 'auto' })
    );

    ProgrammaticScroll.create(CONSTANTS.SCROLL_MARK_DURATION);
    GlobalClose.bind();
    setupHandlers(elements);

    try {
      a11y?.trapFocus(elements.cookieView);
    } catch (e) {
      log.warn('Focus trap failed', e);
    }

    // Initialize toggle states from persisted detail if present
    try {
      const raw = CookieManager.get('cookie_consent_detail');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (elements.analyticsToggle) elements.analyticsToggle.checked = !!parsed.analytics;
        if (elements.adPersonalizationToggle)
          elements.adPersonalizationToggle.checked = !!parsed.ad_personalization;
      }
    } catch (e) {
      /* ignore */
    }

    performance.mark('cookie-settings-open-end');
    performance.measure(
      'cookie-settings-open',
      'cookie-settings-open-start',
      'cookie-settings-open-end'
    );
  };

  const close = () => {
    if (!elements) elements = getElements();

    // Reset Accessibility
    elements?.triggerBtn?.setAttribute('aria-expanded', 'false');

    // Centralized cleanup
    closeFooter();
  };

  return { open, close };
})();

GlobalClose.setCloseHandler(() => CookieSettings.close());

// ===== Central Footer Cleanup Helper =====
function closeFooter() {
  const footer = domCache.get('#site-footer');
  if (!footer) return;

  // 1. Visual Reset
  footer.classList.remove('footer-expanded');
  document.body.classList.remove('footer-expanded');
  footer.querySelector('.footer-maximized')?.classList.add('footer-hidden');
  footer.querySelector('.footer-minimized')?.classList.remove('footer-hidden');

  // 2. Content Reset (show normal content again if it was hidden by cookie view)
  const normal = domCache.get('#footer-normal-content');
  if (normal) normal.style.display = 'block';

  // 3. Hide Cookie View specifically
  const cookieView = domCache.get('#footer-cookie-view');
  if (cookieView) cookieView.classList.add('hidden');

  // 4. Style Reset
  document.documentElement.style.removeProperty('scroll-snap-type');

  // 5. State Reset
  if (globalThis.footerScrollHandler) globalThis.footerScrollHandler.expanded = false;

  // 6. Listener Cleanup
  GlobalClose.unbind();

  // Remove component-specific handlers stored on DOM elements
  try {
    cookieView?._removeHandlers?.();
    normal?._removeHandlers?.();
  } catch {
    /* ignore */
  }

  // 7. A11y Reset
  try {
    a11y?.releaseFocus();
  } catch (e) {
    log.warn('Focus release failed', e);
  }
}

document.addEventListener('footer:requestClose', closeFooter);

// ===== Footer Loader (Optimized) =====
class FooterLoader {
  async init() {
    performance.mark('footer-load-start');
    const container = domCache.get('#footer-container');

    // If no container, assume footer is already in DOM (static) and just init logic
    if (!container && domCache?.get?.('#site-footer')) {
      this.updateYears();
      this.setupInteractions();
      new ConsentBanner().init();
      new ScrollHandler().init();
      new FooterResizer().init();
      return true;
    }
    if (!container) return false;

    // If the container already contains rendered footer HTML (e.g., pre-inserted),
    // initialize behavior without re-fetching the fragment.
    try {
      if (container.querySelector && container.querySelector('#site-footer')) {
        this.updateYears();
        this.setupInteractions();
        new ConsentBanner().init();
        new ScrollHandler().init();
        new FooterResizer().init();
        return true;
      }
    } catch (e) {
      /* ignore */
    }

    try {
      const srcBase = container.dataset.footerSrc || '/content/components/footer/footer';
      const isLocal =
        ['localhost', '127.0.0.1'].some((h) => location.hostname.includes(h)) ||
        location.hostname.endsWith('.local');
      const candidates = isLocal ? [srcBase + '.html', srcBase] : [srcBase, srcBase + '.html'];

      let response;
      for (const c of candidates) {
        try {
          response = await fetch(c);
          if (response?.ok) break;
        } catch {
          response = null;
        }
      }

      if (!response?.ok) throw new Error('Footer load failed');

      container.innerHTML = await response.text();
      domCache?.invalidate?.();

      this.updateYears();
      this.setupInteractions();

      new ConsentBanner().init();
      new ScrollHandler().init();
      new FooterResizer().init();

      document.dispatchEvent(
        new CustomEvent('footer:loaded', { detail: { timestamp: Date.now() } })
      );

      performance.mark('footer-load-end');
      performance.measure('footer-load', 'footer-load-start', 'footer-load-end');
      return true;
    } catch (error) {
      log.error('Footer load failed', error);
      return false;
    }
  }

  updateYears() {
    const year = new Date().getFullYear();
    domCache.getAll('.current-year').forEach((el) => (el.textContent = year));
  }

  setupInteractions() {
    // Newsletter Form
    const form = domCache.get('.newsletter-form-enhanced');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const input = form.querySelector('#newsletter-email');
        if (input && !input.checkValidity()) {
          try {
            a11y?.announce('Bitte gültige E-Mail eingeben', {
              priority: 'assertive',
            });
          } catch {}
          return;
        }

        const btn = form.querySelector('button[type="submit"]');
        if (btn) {
          const originalText = btn.textContent;
          btn.textContent = '✓';
          btn.disabled = true;
          setTimeout(() => {
            btn.textContent = originalText;
            btn.disabled = false;
          }, 3000);
        }
        form.reset();
        try {
          a11y?.announce('Newsletter abonniert', { priority: 'polite' });
        } catch {}
      });
    }

    // Event Delegation
    document.addEventListener(
      'click',
      (e) => {
        const cookieTrigger = e.target.closest('[data-cookie-trigger]');
        const footerTrigger = e.target.closest('[data-footer-trigger]');

        if (cookieTrigger) {
          e.preventDefault();
          CookieSettings.open();
          return;
        }

        if (footerTrigger) {
          e.preventDefault();
          this.handleFooterTrigger();
        }
      },
      { passive: false }
    );

    // Three-Showcase Button
    const showcaseBtn = domCache.get('#threeShowcaseBtn');
    if (showcaseBtn && !showcaseBtn.dataset.init) {
      showcaseBtn.dataset.init = '1';
      showcaseBtn.addEventListener('click', () => {
        showcaseBtn.classList.add('active');
        document.dispatchEvent(
          new CustomEvent('three-earth:showcase', {
            detail: { duration: 8000 },
          })
        );
        setTimeout(() => showcaseBtn.classList.remove('active'), 8000);
      });
    }
  }

  handleFooterTrigger() {
    if (globalThis.footerScrollHandler) {
      globalThis.footerScrollHandler.toggleExpansion(true);
    }
  }
}

// ===== Scroll Handler (Fixed & Optimized) =====
class ScrollHandler {
  expanded = false;
  observer = null;
  _resizeHandler = null;
  _collapseTimer = null;
  _lockUntil = 0;
  _userScrollListener = null;
  _nearBottomPx = 24;
  expandThreshold = 0.05;
  collapseThreshold = 0.02;

  constructor() {
    globalThis.footerScrollHandler = this;
  }

  init() {
    const footer = domCache.get('#site-footer');

    // The trigger is injected by head-inline.js at document start; prefer cached lookup and fallback to DOM.
    let trigger =
      domCache.get('#footer-trigger-zone') || document.getElementById('footer-trigger-zone');

    // If trigger missing, create a robust fallback to avoid race conditions
    if (!trigger) {
      try {
        trigger = document.createElement('div');
        trigger.id = 'footer-trigger-zone';
        trigger.className = 'footer-trigger-zone';
        trigger.setAttribute('aria-hidden', 'true');
        trigger.setAttribute('role', 'presentation');
        trigger.style.pointerEvents = 'none';
        trigger.style.minHeight = '96px';
        trigger.style.width = '100%';

        trigger.dataset.expandThreshold = trigger.dataset.expandThreshold || '0.002';
        trigger.dataset.collapseThreshold = trigger.dataset.collapseThreshold || '0.0008';
        trigger.dataset.expandLockMs = trigger.dataset.expandLockMs || '1000';
        trigger.dataset.collapseDebounceMs = trigger.dataset.collapseDebounceMs || '250';

        if (footer?.parentNode) {
          footer.parentNode.insertBefore(trigger, footer);
        } else if (document.body) {
          // As a last resort, append to body
          document.body.appendChild(trigger);
        }

        // Update domCache so subsequent lookups can find it
        domCache?.invalidate?.();
      } catch (err) {
        try {
          log.warn('ScrollHandler: failed to create fallback #footer-trigger-zone', err);
        } catch {}
      }
    }

    if (!footer || !trigger) {
      // If still missing, log and abort
      try {
        log.warn('ScrollHandler: #footer-trigger-zone not found after fallback; aborting init');
      } catch {}
      return;
    }

    // Initial State Check
    footer.querySelector('.footer-minimized')?.classList.remove('footer-hidden');
    footer.querySelector('.footer-maximized')?.classList.add('footer-hidden');

    const isDesktop = globalThis.matchMedia?.('(min-width: 769px)')?.matches;
    // Slightly smaller thresholds for better first-scroll sensitivity on desktop
    const defaultExpand = isDesktop ? 0.003 : 0.05;
    const defaultCollapse = isDesktop ? 0.001 : 0.02;

    // Apply thresholds + timing values from dataset (per-page overrides)
    this._applyThresholds(trigger, isDesktop, defaultExpand, defaultCollapse);

    // Slightly extend the observer rootMargin on desktop to be more forgiving
    const rootMargin = isDesktop ? '0px 0px -2% 0px' : '0px 0px -10% 0px';

    // Setup intersection observer
    this._setupObserver(trigger, rootMargin);

    // Setup fallback scroll listener & event bindings
    this._setupFallbackListener();

    this._resizeHandler = debounce(() => {
      this.observer?.disconnect();
      this.init();
    }, 150);
    globalThis.addEventListener('resize', this._resizeHandler, {
      passive: true,
    });
  }

  cleanup() {
    this.observer?.disconnect();
    if (this._resizeHandler) globalThis.removeEventListener('resize', this._resizeHandler);
    if (this._collapseTimer) {
      clearTimeout(this._collapseTimer);
      this._collapseTimer = null;
    }
    if (this._userScrollListener) {
      try {
        globalThis.removeEventListener('wheel', this._userScrollListener);
        globalThis.removeEventListener('touchstart', this._userScrollListener);
      } catch {}
      this._userScrollListener = null;
    }
  }

  toggleExpansion(shouldExpand) {
    // Prefer cached lookup but fall back to direct querySelector to avoid stale cache issues
    let footer = domCache.get('#site-footer');
    if (!footer) footer = document.querySelector('#site-footer');
    if (!footer) return;

    // Debug probe for tests and CI
    try {
      globalThis._lastToggleCall = { ts: Date.now(), shouldExpand };
    } catch {}

    const min = footer.querySelector('.footer-minimized');
    const max = footer.querySelector('.footer-maximized');

    if (shouldExpand && !this.expanded) {
      // Cancel any pending collapse and expand immediately
      if (this._collapseTimer) {
        clearTimeout(this._collapseTimer);
        this._collapseTimer = null;
        this._scheduledCollapse = false;
      }

      this._expandFooter(footer, min, max);
      return;
    }

    if (!shouldExpand && this.expanded) {
      const now = Date.now();

      // If still in post-expand lock period schedule collapse after lock + debounce
      if (now < (this._lockUntil || 0)) {
        const delay =
          this._lockUntil - now + (this.collapseDebounceMs || CONSTANTS.COLLAPSE_DEBOUNCE_MS);
        this._scheduleCollapse(delay);
        return;
      }

      // Otherwise schedule normal debounce collapse
      this._scheduleCollapse(this.collapseDebounceMs || CONSTANTS.COLLAPSE_DEBOUNCE_MS);
    }
  }

  _expandFooter(footer, min, max) {
    ProgrammaticScroll.create(1000);
    GlobalClose.bind();
    document.documentElement.style.scrollSnapType = 'none';

    try {
      footer.classList.add('footer-expanded');
      footer.setAttribute(
        'class',
        (footer.getAttribute('class') || '')
          .split(' ')
          .concat(['footer-expanded'])
          .filter(Boolean)
          .join(' ')
      );
    } catch {}

    try {
      document.body.classList.add('footer-expanded');
      document.body.setAttribute(
        'class',
        (document.body.getAttribute('class') || '')
          .split(' ')
          .concat(['footer-expanded'])
          .filter(Boolean)
          .join(' ')
      );
    } catch {}

    max?.classList.remove('footer-hidden');
    min?.classList.add('footer-hidden');

    this.expanded = true;
    // Set a short lock period to avoid immediate collapse from tiny scroll jitter
    this._lockUntil = Date.now() + (this.expandLockMs || CONSTANTS.EXPAND_LOCK_MS);
  }

  _applyThresholds(trigger, isDesktop, defaultExpand, defaultCollapse) {
    try {
      const { expandThreshold, collapseThreshold, expandLockMs, collapseDebounceMs } =
        trigger.dataset;
      this.expandThreshold = expandThreshold ? Number.parseFloat(expandThreshold) : defaultExpand;
      this.collapseThreshold = collapseThreshold
        ? Number.parseFloat(collapseThreshold)
        : defaultCollapse;

      const parsedLock = expandLockMs ? Number.parseInt(expandLockMs, 10) : Number.NaN;
      const parsedDebounce = collapseDebounceMs
        ? Number.parseInt(collapseDebounceMs, 10)
        : Number.NaN;

      // Increase defaults: Desktop 1000ms, Mobile 500ms
      const defaultLock = isDesktop ? 1000 : 500;
      const defaultDebounce = isDesktop ? 250 : 200;
      this.expandLockMs = !Number.isNaN(parsedLock) && parsedLock >= 0 ? parsedLock : defaultLock;
      this.collapseDebounceMs =
        !Number.isNaN(parsedDebounce) && parsedDebounce >= 0 ? parsedDebounce : defaultDebounce;
    } catch {
      this.expandThreshold = defaultExpand;
      this.collapseThreshold = defaultCollapse;
      this.expandLockMs = isDesktop ? 1000 : 500;
      this.collapseDebounceMs = isDesktop ? 250 : 200;
    }
  }

  _setupObserver(trigger, rootMargin) {
    this.observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        if (!entry.isIntersecting && ProgrammaticScroll.hasActive()) return;

        // Save last observed values for decision-making during scheduled collapse
        this._lastIntersectionRatio = entry.intersectionRatio;
        this._lastIsIntersecting = entry.isIntersecting;

        // Logic: Expand if we hit the bottom trigger significantly
        const shouldExpand =
          entry.isIntersecting && entry.intersectionRatio >= this.expandThreshold;

        // Prevent collapse if we are just slightly scrolling but still near bottom
        if (!shouldExpand && this.expanded && entry.intersectionRatio > this.collapseThreshold)
          return;

        // If collapse requested shortly after expand, let toggleExpansion decide via lock/debounce
        this.toggleExpansion(shouldExpand);
      },
      { rootMargin, threshold: [this.collapseThreshold, this.expandThreshold] }
    );

    this.observer.observe(trigger);
  }

  _setupFallbackListener() {
    // Fallback: listen for small user scrolls near the bottom as IO can be flaky
    this._userScrollListener = (e) => {
      if (ProgrammaticScroll.hasActive()) return;
      if (this.expanded) return;

      const scrollY = globalThis.scrollY || globalThis.pageYOffset || 0;
      const nearBottom =
        (globalThis.innerHeight || 0) + scrollY >=
        document.body.scrollHeight - (this._nearBottomPx || 24);
      if (!nearBottom) return;

      // For wheel events ensure the user is scrolling downwards (deltaY > 0)
      if (e?.type === 'wheel' && typeof e.deltaY === 'number' && e.deltaY <= 0) return;

      // Trigger expansion as a robust fallback when IO didn't report intersecting
      try {
        this.toggleExpansion(true);
      } catch (err) {
        log.warn('fallback scroll expand failed', err);
      }
    };

    globalThis.addEventListener('wheel', this._userScrollListener, {
      passive: true,
    });
    globalThis.addEventListener('touchstart', this._userScrollListener, {
      passive: true,
    });
  }

  _scheduleCollapse(delay) {
    if (this._collapseTimer) clearTimeout(this._collapseTimer);
    this._scheduledCollapse = true;
    this._collapseTimer = setTimeout(() => {
      this._scheduledCollapse = false;
      const lastRatio = this._lastIntersectionRatio ?? 0;
      const lastIntersecting = !!this._lastIsIntersecting;
      const shouldCancel = lastIntersecting && lastRatio >= this.collapseThreshold;
      if (shouldCancel) {
        this._collapseTimer = null;
        return;
      }
      try {
        closeFooter();
      } catch (err) {
        log.warn('scheduled close failed', err);
      }
      this.expanded = false;
      this._collapseTimer = null;
    }, delay);
  }
}

// ===== Footer Resizer (Optimized) =====
class FooterResizer {
  constructor() {
    this.debouncedApply = debounce(this.apply.bind(this), CONSTANTS.RESIZE_DEBOUNCE);
  }

  init() {
    globalThis.addEventListener('resize', this.debouncedApply, {
      passive: true,
    });
    this.apply();
  }

  apply() {
    const content = domCache.get('#site-footer .footer-enhanced-content');
    if (!content) return;
    const height = Math.min(Math.max(0, content.scrollHeight), (globalThis.innerHeight || 0) - 24);
    if (height > 0)
      document.documentElement.style.setProperty('--footer-actual-height', `${height}px`);
  }
}

// ===== Auto-Start =====
export const initFooter = () => new FooterLoader().init();
