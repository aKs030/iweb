/**
 * Footer App - Kompakte Version ohne Duplikate
 * @version 1.0.0
 * Vereint alle Footer-Funktionen in einer Datei
 */

import {
  createLogger,
  CookieManager,
  debounce,
} from '/content/utils/shared-utilities.js';
import { a11y } from '/content/utils/accessibility-manager.js';

const log = createLogger('FooterApp');

// ===== Konstanten =====
const CONSTANTS = {
  SCROLL_MARK_DURATION: 1000,
  SCROLL_WATCH_TIMEOUT: 5000,
  SCROLL_THRESHOLD: 6,
  RESIZE_DEBOUNCE: 150,
  EXPAND_LOCK_MS: 1000,
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
      for (const key of this.cache.keys()) {
        if (key.startsWith(selector)) this.cache.delete(key);
      }
    } else {
      this.cache.clear();
    }
  }
}

const domCache = new DOMCache();

// ===== Programmatic Scroll =====
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
  };
})();

// ===== Global Close Handler =====
const GlobalClose = (() => {
  let closeHandler = null;
  let bound = false;

  const onDocClick = (e) => {
    const footer = domCache.get('#site-footer');
    if (!footer?.classList.contains('footer-expanded')) return;
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
      }
      bound = true;
    },
    unbind() {
      if (!bound) return;
      document.removeEventListener('click', onDocClick, true);
      globalThis.removeEventListener('wheel', onUserScroll);
      globalThis.removeEventListener('scroll', onUserScroll);
      globalThis.removeEventListener('touchmove', onUserScroll);
      bound = false;
    },
  };
})();

// ===== Analytics =====
const GoogleAnalytics = {
  load() {
    const blockedScripts = document.querySelectorAll(
      'script[data-consent="required"]',
    );
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
    log.info('Google Analytics loaded');
  },
};

function updateGtagConsent(input = true) {
  try {
    if (typeof gtag !== 'function') return;
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
  } catch {
    /* ignore */
  }
}

// ===== Consent Banner =====
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
      updateGtagConsent(true);
      GoogleAnalytics.load();
      banner.classList.add('hidden');
    } else if (consent === 'rejected') {
      updateGtagConsent(false);
      banner.classList.add('hidden');
    } else {
      banner.classList.remove('hidden');
    }

    acceptBtn.addEventListener('click', () => this.accept(), { once: false });
    if (rejectBtn) {
      rejectBtn.addEventListener('click', () => this.reject(), { once: false });
    }
  }

  accept() {
    this.elements.banner.classList.add('hidden');
    CookieManager.set('cookie_consent', 'accepted');
    globalThis.dataLayer = globalThis.dataLayer || [];
    globalThis.dataLayer.push({ event: 'consentGranted' });
    updateGtagConsent(true);
    GoogleAnalytics.load();
    a11y?.announce('Cookie-Präferenz: Alle Cookies akzeptiert', {
      priority: 'polite',
    });
  }

  reject() {
    this.elements.banner.classList.add('hidden');
    CookieManager.set('cookie_consent', 'rejected');
    a11y?.announce('Cookie-Präferenz: Nur notwendige Cookies akzeptiert', {
      priority: 'polite',
    });
  }
}

// ===== Cookie Settings =====
const CookieSettings = (() => {
  let elements = null;

  const getElements = () => ({
    footer: domCache.get('#site-footer'),
    cookieView: domCache.get('#footer-cookie-view'),
    normalContent: domCache.get('#footer-normal-content'),
    analyticsToggle: domCache.get('#footer-analytics-toggle'),
    adPersonalizationToggle: domCache.get('#footer-ad-personalization-toggle'),
    closeBtn: domCache.get('#close-cookie-footer'),
    rejectAllBtn: domCache.get('#footer-reject-all'),
    acceptSelectedBtn: domCache.get('#footer-accept-selected'),
    acceptAllBtn: domCache.get('#footer-accept-all'),
    triggerBtn: domCache.get('#footer-cookies-link'),
  });

  const open = () => {
    elements = getElements();
    if (!elements.footer || !elements.cookieView) return;

    const consent = CookieManager.get('cookie_consent');
    if (elements.analyticsToggle) {
      elements.analyticsToggle.checked = consent === 'accepted';
    }

    document.documentElement.style.scrollSnapType = 'none';
    elements.footer.classList.add('footer-expanded');
    document.body.classList.add('footer-expanded');
    elements.cookieView.classList.remove('hidden');
    if (elements.normalContent) elements.normalContent.style.display = 'none';
    if (elements.triggerBtn)
      elements.triggerBtn.setAttribute('aria-expanded', 'true');

    requestAnimationFrame(() =>
      globalThis.scrollTo({
        top: document.body.scrollHeight,
        behavior: 'auto',
      }),
    );

    ProgrammaticScroll.create(CONSTANTS.SCROLL_MARK_DURATION);
    GlobalClose.bind();
    a11y?.trapFocus(elements.cookieView);

    // Event Listeners
    elements.closeBtn?.addEventListener('click', close);
    elements.rejectAllBtn?.addEventListener('click', () => {
      CookieManager.set('cookie_consent', 'rejected');
      CookieManager.set(
        'cookie_consent_detail',
        JSON.stringify({ analytics: false, ad_personalization: false }),
      );
      CookieManager.deleteAnalytics();
      updateGtagConsent(false);
      a11y?.announce('Cookie-Einstellungen: Nur notwendige Cookies aktiv', {
        priority: 'polite',
      });
      close();
      domCache.get('#cookie-consent-banner')?.classList.add('hidden');
    });
    elements.acceptSelectedBtn?.addEventListener('click', () => {
      const analyticsEnabled = !!elements.analyticsToggle?.checked;
      const adPersonalizationEnabled =
        !!elements.adPersonalizationToggle?.checked;
      const detail = {
        analytics: analyticsEnabled,
        ad_personalization: adPersonalizationEnabled,
      };
      CookieManager.set('cookie_consent_detail', JSON.stringify(detail));
      CookieManager.set(
        'cookie_consent',
        analyticsEnabled || adPersonalizationEnabled ? 'accepted' : 'rejected',
      );
      globalThis.dataLayer = globalThis.dataLayer || [];
      globalThis.dataLayer.push({ event: 'consentGranted', detail });
      updateGtagConsent({
        analytics_storage: analyticsEnabled ? 'granted' : 'denied',
        ad_storage: adPersonalizationEnabled ? 'granted' : 'denied',
        ad_user_data: adPersonalizationEnabled ? 'granted' : 'denied',
        ad_personalization: adPersonalizationEnabled ? 'granted' : 'denied',
      });
      if (analyticsEnabled) GoogleAnalytics.load();
      else CookieManager.deleteAnalytics();
      a11y?.announce(
        analyticsEnabled
          ? 'Cookie-Einstellungen gespeichert: Analyse aktiviert'
          : 'Cookie-Einstellungen gespeichert: Analyse deaktiviert',
        { priority: 'polite' },
      );
      close();
      domCache.get('#cookie-consent-banner')?.classList.add('hidden');
    });
    elements.acceptAllBtn?.addEventListener('click', () => {
      CookieManager.set('cookie_consent', 'accepted');
      CookieManager.set(
        'cookie_consent_detail',
        JSON.stringify({ analytics: true, ad_personalization: true }),
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
      a11y?.announce('Cookie-Einstellungen: Alle Cookies aktiviert', {
        priority: 'polite',
      });
      close();
      domCache.get('#cookie-consent-banner')?.classList.add('hidden');
    });

    // Initialize toggle states
    try {
      const raw = CookieManager.get('cookie_consent_detail');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (elements.analyticsToggle)
          elements.analyticsToggle.checked = !!parsed.analytics;
        if (elements.adPersonalizationToggle)
          elements.adPersonalizationToggle.checked =
            !!parsed.ad_personalization;
      }
    } catch (e) {
      /* ignore */
    }
  };

  const close = () => {
    if (!elements) elements = getElements();
    elements?.triggerBtn?.setAttribute('aria-expanded', 'false');
    closeFooter();
  };

  return { open, close };
})();

GlobalClose.setCloseHandler(() => CookieSettings.close());

// ===== Footer Close Helper =====
function closeFooter() {
  const footer = domCache.get('#site-footer');
  if (!footer) return;

  footer.classList.remove('footer-expanded');
  document.body.classList.remove('footer-expanded');
  footer.querySelector('.footer-maximized')?.classList.add('footer-hidden');
  const minEl = footer.querySelector('.footer-minimized');
  if (minEl) {
    minEl.classList.remove('footer-hidden');
    minEl.setAttribute('aria-hidden', 'false');
  }
  footer.setAttribute('aria-expanded', 'false');

  const normal = domCache.get('#footer-normal-content');
  if (normal) normal.style.display = 'block';

  const cookieView = domCache.get('#footer-cookie-view');
  if (cookieView) cookieView.classList.add('hidden');

  document.documentElement.style.removeProperty('scroll-snap-type');
  if (globalThis.footerScrollHandler)
    globalThis.footerScrollHandler.expanded = false;
  GlobalClose.unbind();
  a11y?.releaseFocus();
}

// ===== Scroll Handler =====
class ScrollHandler {
  expanded = false;
  observer = null;
  _resizeHandler = null;
  _collapseTimer = null;
  _lockUntil = 0;

  constructor() {
    globalThis.footerScrollHandler = this;
  }

  init() {
    const footer = domCache.get('#site-footer');
    let trigger =
      domCache.get('#footer-trigger-zone') ||
      document.getElementById('footer-trigger-zone');

    if (!trigger) {
      trigger = document.createElement('div');
      trigger.id = 'footer-trigger-zone';
      trigger.className = 'footer-trigger-zone';
      trigger.setAttribute('aria-hidden', 'true');
      trigger.style.pointerEvents = 'none';
      trigger.style.minHeight = '96px';
      trigger.style.width = '100%';
      if (footer?.parentNode) {
        footer.parentNode.insertBefore(trigger, footer);
      } else if (document.body) {
        document.body.appendChild(trigger);
      }
      domCache?.invalidate?.();
    }

    if (!footer || !trigger) return;

    footer
      .querySelector('.footer-minimized')
      ?.classList.remove('footer-hidden');
    footer.querySelector('.footer-maximized')?.classList.add('footer-hidden');

    const isDesktop = globalThis.matchMedia?.('(min-width: 769px)')?.matches;
    const expandThreshold = isDesktop ? 0.003 : 0.05;
    const collapseThreshold = isDesktop ? 0.001 : 0.02;
    const rootMargin = isDesktop ? '0px 0px -2% 0px' : '0px 0px -10% 0px';

    this.observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry || (!entry.isIntersecting && ProgrammaticScroll.hasActive()))
          return;

        const shouldExpand =
          entry.isIntersecting && entry.intersectionRatio >= expandThreshold;
        if (
          !shouldExpand &&
          this.expanded &&
          entry.intersectionRatio > collapseThreshold
        )
          return;

        this.toggleExpansion(shouldExpand);
      },
      { rootMargin, threshold: [collapseThreshold, expandThreshold] },
    );

    this.observer.observe(trigger);

    this._resizeHandler = debounce(() => {
      this.observer?.disconnect();
      this.init();
    }, 150);
    globalThis.addEventListener('resize', this._resizeHandler, {
      passive: true,
    });
  }

  toggleExpansion(shouldExpand) {
    const footer =
      domCache.get('#site-footer') || document.querySelector('#site-footer');
    if (!footer) return;

    const min = footer.querySelector('.footer-minimized');
    const max = footer.querySelector('.footer-maximized');

    if (shouldExpand && !this.expanded) {
      if (this._collapseTimer) {
        clearTimeout(this._collapseTimer);
        this._collapseTimer = null;
      }
      ProgrammaticScroll.create(1000);
      GlobalClose.bind();
      document.documentElement.style.scrollSnapType = 'none';
      footer.classList.add('footer-expanded');
      footer.setAttribute('aria-expanded', 'true');
      document.body.classList.add('footer-expanded');
      max?.classList.remove('footer-hidden');
      min?.classList.add('footer-hidden');
      min?.setAttribute('aria-hidden', 'true');
      this.expanded = true;
      this._lockUntil = Date.now() + CONSTANTS.EXPAND_LOCK_MS;
      return;
    }

    if (!shouldExpand && this.expanded) {
      const now = Date.now();
      const delay =
        now < this._lockUntil
          ? this._lockUntil - now + CONSTANTS.COLLAPSE_DEBOUNCE_MS
          : CONSTANTS.COLLAPSE_DEBOUNCE_MS;
      if (this._collapseTimer) clearTimeout(this._collapseTimer);
      this._collapseTimer = setTimeout(() => {
        closeFooter();
        this.expanded = false;
        this._collapseTimer = null;
      }, delay);
    }
  }
}

// ===== Footer Loader =====
class FooterLoader {
  async init() {
    const container = domCache.get('#footer-container');

    if (!container && domCache?.get?.('#site-footer')) {
      this.updateYears();
      this.setupInteractions();
      new ConsentBanner().init();
      new ScrollHandler().init();
      return true;
    }

    if (!container) return false;

    if (container.querySelector && container.querySelector('#site-footer')) {
      this.updateYears();
      this.setupInteractions();
      new ConsentBanner().init();
      new ScrollHandler().init();
      return true;
    }

    try {
      const srcBase =
        container.dataset.footerSrc || '/content/components/footer/footer';
      const isLocal =
        ['localhost', '127.0.0.1'].some((h) => location.hostname.includes(h)) ||
        location.hostname.endsWith('.local');
      const candidates = isLocal
        ? [srcBase + '.html', srcBase]
        : [srcBase, srcBase + '.html'];

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

      document.dispatchEvent(
        new CustomEvent('footer:loaded', { detail: { timestamp: Date.now() } }),
      );
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
          a11y?.announce('Bitte gültige E-Mail eingeben', {
            priority: 'assertive',
          });
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
        a11y?.announce('Newsletter abonniert', { priority: 'polite' });
      });
    }

    // Event Delegation
    document.addEventListener(
      'click',
      (e) => {
        const cookieTrigger = e.target.closest('[data-cookie-trigger]');
        const footerMinClick = e.target.closest('.footer-minimized');

        if (cookieTrigger) {
          e.preventDefault();
          CookieSettings.open();
          return;
        }

        if (footerMinClick) {
          const interactive = e.target.closest(
            'a, button, input, textarea, select, [data-cookie-trigger]',
          );
          if (!interactive) {
            e.preventDefault();
            if (globalThis.footerScrollHandler) {
              globalThis.footerScrollHandler.toggleExpansion(true);
            }
            return;
          }
        }
      },
      { passive: false },
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
          }),
        );
        setTimeout(() => showcaseBtn.classList.remove('active'), 8000);
      });
    }
  }
}

// ===== Export =====
export const initFooter = () => new FooterLoader().init();
