/**
 * Footer App - Kompakte Version
 * @version 2.0.0
 * Alle Footer-Funktionen in einer Datei
 */

import {
  createLogger,
  CookieManager,
  debounce,
} from '/content/utils/shared-utilities.js';
import { a11y } from '/content/utils/accessibility-manager.js';

const log = createLogger('FooterApp');

// Polyfill for inert attribute (for older browsers)
if (!('inert' in HTMLElement.prototype)) {
  Object.defineProperty(HTMLElement.prototype, 'inert', {
    enumerable: true,
    get() {
      return this.hasAttribute('inert');
    },
    set(value) {
      if (value) {
        this.setAttribute('inert', '');
        this.setAttribute('aria-hidden', 'true');
      } else {
        this.removeAttribute('inert');
        this.removeAttribute('aria-hidden');
      }
    },
  });
}

const CONFIG = {
  SCROLL_MARK_DURATION: 1000,
  RESIZE_DEBOUNCE: 150,
  EXPAND_LOCK_MS: 1000,
  COLLAPSE_DEBOUNCE_MS: 250,
  FOOTER_HTML_PATH: '/content/components/footer/footer.html',
};

const dom = {
  cache: new Map(),
  get: (selector, parent = document) => {
    const key = `${selector}-${parent === document ? 'doc' : 'parent'}`;
    const cached = dom.cache.get(key);
    if (cached && document.contains(cached)) return cached;
    const element = parent.querySelector(selector);
    if (element) dom.cache.set(key, element);
    return element;
  },
  getAll: (selector) => {
    const key = `all-${selector}`;
    const cached = dom.cache.get(key);
    if (cached?.length && cached.every(el => document.contains(el))) return cached;
    const elements = Array.from(document.querySelectorAll(selector));
    if (elements.length) dom.cache.set(key, elements);
    return elements;
  },
  clear: () => dom.cache.clear(),
};

const scrollManager = {
  activeToken: null,
  timer: null,
  create: (duration = CONFIG.SCROLL_MARK_DURATION) => {
    if (scrollManager.timer) clearTimeout(scrollManager.timer);
    const token = Symbol('progScroll');
    scrollManager.activeToken = token;
    if (duration > 0) {
      scrollManager.timer = setTimeout(() => {
        if (scrollManager.activeToken === token) scrollManager.activeToken = null;
        scrollManager.timer = null;
      }, duration);
    }
    return token;
  },
  clear: () => {
    scrollManager.activeToken = null;
    if (scrollManager.timer) clearTimeout(scrollManager.timer);
    scrollManager.timer = null;
  },
  hasActive: () => !!scrollManager.activeToken,
};

const globalClose = {
  closeHandler: null,
  bound: false,
  onDocClick: (e) => {
    const footer = dom.get('#site-footer');
    if (!footer?.classList.contains('footer-expanded')) return;
    if (e.target.closest('#site-footer')) return;
    globalClose.closeHandler?.();
  },
  onUserScroll: () => {
    if (scrollManager.hasActive()) return;
    const footer = dom.get('#site-footer');
    if (!footer?.classList.contains('footer-expanded')) return;
    globalClose.closeHandler?.();
  },
  setCloseHandler: (fn) => (globalClose.closeHandler = fn),
  bind: () => {
    if (globalClose.bound) return;
    const isMobile = globalThis.matchMedia?.('(max-width: 768px)')?.matches;
    if (isMobile) {
      globalThis.addEventListener('scroll', globalClose.onUserScroll, { passive: true });
      globalThis.addEventListener('touchmove', globalClose.onUserScroll, { passive: true });
    } else {
      document.addEventListener('click', globalClose.onDocClick, { capture: true, passive: true });
      globalThis.addEventListener('wheel', globalClose.onUserScroll, { passive: true });
    }
    globalClose.bound = true;
  },
  unbind: () => {
    if (!globalClose.bound) return;
    document.removeEventListener('click', globalClose.onDocClick, true);
    globalThis.removeEventListener('wheel', globalClose.onUserScroll);
    globalThis.removeEventListener('scroll', globalClose.onUserScroll);
    globalThis.removeEventListener('touchmove', globalClose.onUserScroll);
    globalClose.bound = false;
  },
};

const analytics = {
  load: () => {
    document.querySelectorAll('script[data-consent="required"]').forEach((script) => {
      const newScript = document.createElement('script');
      [...script.attributes].forEach((attr) => {
        const name = attr.name === 'data-src' ? 'src' : attr.name;
        if (!['data-consent', 'type'].includes(attr.name)) {
          newScript.setAttribute(name, attr.value);
        }
      });
      if (script.innerHTML.trim()) newScript.innerHTML = script.innerHTML;
      script.parentNode.replaceChild(newScript, script);
    });
    log.info('Analytics loaded');
  },
  updateConsent: (input = true) => {
    if (typeof gtag !== 'function') return;
    const status = (val) => val ? 'granted' : 'denied';
    const payload = typeof input === 'boolean'
      ? { ad_storage: status(input), analytics_storage: status(input), ad_user_data: status(input), ad_personalization: status(input) }
      : { ad_storage: input.ad_storage || status(input.granted), analytics_storage: input.analytics_storage || status(input.granted), ad_user_data: input.ad_user_data || status(input.granted), ad_personalization: input.ad_personalization || status(input.granted) };
    try { gtag('consent', 'update', payload); } catch { /* ignore */ }
  },
};

const consentBanner = {
  handlers: new Map(),
  init: () => {
    const banner = dom.get('#cookie-consent-banner');
    const acceptBtn = dom.get('#accept-cookies-btn');
    const rejectBtn = dom.get('#reject-cookies-btn');
    if (!banner || !acceptBtn) return;

    const consent = CookieManager.get('cookie_consent');
    banner.classList.toggle('hidden', consent === 'accepted' || consent === 'rejected');
    
    if (consent === 'accepted') {
      analytics.updateConsent(true);
      analytics.load();
    } else if (consent === 'rejected') {
      analytics.updateConsent(false);
    }

    // Remove old handlers
    consentBanner.cleanup();
    
    // Store handlers for cleanup
    const acceptHandler = () => consentBanner.accept();
    const rejectHandler = () => consentBanner.reject();
    
    acceptBtn.addEventListener('click', acceptHandler);
    rejectBtn?.addEventListener('click', rejectHandler);
    
    consentBanner.handlers.set('accept', { element: acceptBtn, handler: acceptHandler });
    if (rejectBtn) consentBanner.handlers.set('reject', { element: rejectBtn, handler: rejectHandler });
  },
  cleanup: () => {
    consentBanner.handlers.forEach(({ element, handler }) => {
      element?.removeEventListener('click', handler);
    });
    consentBanner.handlers.clear();
  },
  accept: () => {
    dom.get('#cookie-consent-banner')?.classList.add('hidden');
    CookieManager.set('cookie_consent', 'accepted');
    (globalThis.dataLayer = globalThis.dataLayer || []).push({ event: 'consentGranted' });
    analytics.updateConsent(true);
    analytics.load();
    a11y?.announce('Alle Cookies akzeptiert', { priority: 'polite' });
  },
  reject: () => {
    dom.get('#cookie-consent-banner')?.classList.add('hidden');
    CookieManager.set('cookie_consent', 'rejected');
    a11y?.announce('Nur notwendige Cookies akzeptiert', { priority: 'polite' });
  },
};

const cookieSettings = {
  elements: null,
  handlers: new Map(),
  getElements: () => ({
    footer: dom.get('#site-footer'),
    cookieView: dom.get('#footer-cookie-view'),
    normalContent: dom.get('#footer-normal-content'),
    analyticsToggle: dom.get('#footer-analytics-toggle'),
    adPersonalizationToggle: dom.get('#footer-ad-personalization-toggle'),
    closeBtn: dom.get('#close-cookie-footer'),
    rejectAllBtn: dom.get('#footer-reject-all'),
    acceptSelectedBtn: dom.get('#footer-accept-selected'),
    acceptAllBtn: dom.get('#footer-accept-all'),
    triggerBtn: dom.get('#footer-cookies-link'),
  }),

  open: () => {
    cookieSettings.elements = cookieSettings.getElements();
    const { footer, cookieView, normalContent, analyticsToggle, triggerBtn } = cookieSettings.elements;
    if (!footer || !cookieView) return;

    if (analyticsToggle) analyticsToggle.checked = CookieManager.get('cookie_consent') === 'accepted';

    document.documentElement.style.scrollSnapType = 'none';
    footer.classList.add('footer-expanded');
    document.body.classList.add('footer-expanded');
    
    // Ensure footer is maximized first
    const maxEl = footer.querySelector('.footer-maximized');
    const minEl = footer.querySelector('.footer-minimized');
    
    if (maxEl) maxEl.classList.remove('footer-hidden');
    if (minEl) {
      minEl.classList.add('footer-hidden');
      minEl.setAttribute('inert', '');
      minEl.setAttribute('tabindex', '-1');
    }
    
    // Update scroll handler state
    if (globalThis.footerScrollHandler) {
      globalThis.footerScrollHandler.expanded = true;
    }
    
    cookieView.classList.remove('hidden');
    if (normalContent) normalContent.style.display = 'none';
    triggerBtn?.setAttribute('aria-expanded', 'true');
    footer.setAttribute('aria-expanded', 'true');

    requestAnimationFrame(() => globalThis.scrollTo({ top: document.body.scrollHeight, behavior: 'auto' }));
    scrollManager.create(CONFIG.SCROLL_MARK_DURATION);
    globalClose.bind();
    a11y?.trapFocus(cookieView);

    cookieSettings.bindEvents();
    cookieSettings.loadToggles();
  },
  close: () => {
    if (!cookieSettings.elements) cookieSettings.elements = cookieSettings.getElements();
    const { cookieView, normalContent, triggerBtn } = cookieSettings.elements;
    
    // Hide cookie view and show normal content
    cookieView?.classList.add('hidden');
    if (normalContent) normalContent.style.display = 'block';
    triggerBtn?.setAttribute('aria-expanded', 'false');
    
    cookieSettings.cleanup();
    
    // Close footer completely
    footerManager.closeFooter();
  },

  bindEvents: () => {
    const { closeBtn, rejectAllBtn, acceptSelectedBtn, acceptAllBtn } = cookieSettings.elements;
    const hideBanner = () => dom.get('#cookie-consent-banner')?.classList.add('hidden');
    
    // Cleanup old handlers
    cookieSettings.cleanup();
    
    const handlers = {
      close: () => cookieSettings.close(),
      rejectAll: () => {
        CookieManager.set('cookie_consent', 'rejected');
        CookieManager.set('cookie_consent_detail', JSON.stringify({ analytics: false, ad_personalization: false }));
        CookieManager.deleteAnalytics();
        analytics.updateConsent(false);
        a11y?.announce('Nur notwendige Cookies aktiv', { priority: 'polite' });
        cookieSettings.close();
        hideBanner();
      },
      acceptSelected: () => {
        const analyticsEnabled = !!cookieSettings.elements.analyticsToggle?.checked;
        const adPersonalizationEnabled = !!cookieSettings.elements.adPersonalizationToggle?.checked;
        const detail = { analytics: analyticsEnabled, ad_personalization: adPersonalizationEnabled };
        
        CookieManager.set('cookie_consent_detail', JSON.stringify(detail));
        CookieManager.set('cookie_consent', analyticsEnabled || adPersonalizationEnabled ? 'accepted' : 'rejected');
        (globalThis.dataLayer = globalThis.dataLayer || []).push({ event: 'consentGranted', detail });
        
        analytics.updateConsent({
          analytics_storage: analyticsEnabled ? 'granted' : 'denied',
          ad_storage: adPersonalizationEnabled ? 'granted' : 'denied',
          ad_user_data: adPersonalizationEnabled ? 'granted' : 'denied',
          ad_personalization: adPersonalizationEnabled ? 'granted' : 'denied',
        });
        
        analyticsEnabled ? analytics.load() : CookieManager.deleteAnalytics();
        a11y?.announce(analyticsEnabled ? 'Analyse aktiviert' : 'Analyse deaktiviert', { priority: 'polite' });
        cookieSettings.close();
        hideBanner();
      },
      acceptAll: () => {
        CookieManager.set('cookie_consent', 'accepted');
        CookieManager.set('cookie_consent_detail', JSON.stringify({ analytics: true, ad_personalization: true }));
        (globalThis.dataLayer = globalThis.dataLayer || []).push({ event: 'consentGranted', detail: { analytics: true, ad_personalization: true } });
        analytics.updateConsent({ analytics_storage: 'granted', ad_storage: 'granted', ad_user_data: 'granted', ad_personalization: 'granted' });
        analytics.load();
        a11y?.announce('Alle Cookies aktiviert', { priority: 'polite' });
        cookieSettings.close();
        hideBanner();
      }
    };
    
    closeBtn?.addEventListener('click', handlers.close);
    rejectAllBtn?.addEventListener('click', handlers.rejectAll);
    acceptSelectedBtn?.addEventListener('click', handlers.acceptSelected);
    acceptAllBtn?.addEventListener('click', handlers.acceptAll);
    
    cookieSettings.handlers.set('close', { element: closeBtn, handler: handlers.close });
    cookieSettings.handlers.set('rejectAll', { element: rejectAllBtn, handler: handlers.rejectAll });
    cookieSettings.handlers.set('acceptSelected', { element: acceptSelectedBtn, handler: handlers.acceptSelected });
    cookieSettings.handlers.set('acceptAll', { element: acceptAllBtn, handler: handlers.acceptAll });
  },
  cleanup: () => {
    cookieSettings.handlers.forEach(({ element, handler }) => {
      element?.removeEventListener('click', handler);
    });
    cookieSettings.handlers.clear();
  },
  loadToggles: () => {
    try {
      const detail = JSON.parse(CookieManager.get('cookie_consent_detail') || '{}');
      const { analyticsToggle, adPersonalizationToggle } = cookieSettings.elements;
      if (analyticsToggle) analyticsToggle.checked = !!detail.analytics;
      if (adPersonalizationToggle) adPersonalizationToggle.checked = !!detail.ad_personalization;
    } catch { /* ignore */ }
  },
};

globalClose.setCloseHandler(cookieSettings.close);

const footerManager = {
  closeFooter: () => {
    const footer = dom.get('#site-footer');
    if (!footer) return;

    footer.classList.remove('footer-expanded');
    document.body.classList.remove('footer-expanded');
    footer.querySelector('.footer-maximized')?.classList.add('footer-hidden');
    
    const minEl = footer.querySelector('.footer-minimized');
    if (minEl) {
      minEl.classList.remove('footer-hidden');
      minEl.removeAttribute('inert');
      minEl.setAttribute('tabindex', '0');
    }
    footer.setAttribute('aria-expanded', 'false');

    const normal = dom.get('#footer-normal-content');
    if (normal) normal.style.display = 'block';
    
    dom.get('#footer-cookie-view')?.classList.add('hidden');
    document.documentElement.style.removeProperty('scroll-snap-type');
    
    if (globalThis.footerScrollHandler) globalThis.footerScrollHandler.expanded = false;
    globalClose.unbind();
    a11y?.releaseFocus();
  },
};

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
    const footer = dom.get('#site-footer');
    let trigger = dom.get('#footer-trigger-zone');

    if (!trigger) {
      trigger = document.createElement('div');
      trigger.id = 'footer-trigger-zone';
      trigger.className = 'footer-trigger-zone';
      trigger.setAttribute('aria-hidden', 'true');
      Object.assign(trigger.style, { pointerEvents: 'none', minHeight: '96px', width: '100%' });
      (footer?.parentNode || document.body).insertBefore(trigger, footer || null);
      dom.clear();
    }

    if (!footer || !trigger) return;

    const minEl = footer.querySelector('.footer-minimized');
    const maxEl = footer.querySelector('.footer-maximized');
    
    minEl?.classList.remove('footer-hidden');
    maxEl?.classList.add('footer-hidden');
    
    // Ensure minimized footer is interactive
    if (minEl) {
      minEl.removeAttribute('inert');
      minEl.setAttribute('tabindex', '0');
    }

    const isDesktop = globalThis.matchMedia?.('(min-width: 769px)')?.matches;
    const expandThreshold = isDesktop ? 0.003 : 0.05;
    const collapseThreshold = isDesktop ? 0.001 : 0.02;
    const rootMargin = isDesktop ? '0px 0px -2% 0px' : '0px 0px -10% 0px';

    this.observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry || (!entry.isIntersecting && scrollManager.hasActive())) return;

        const shouldExpand = entry.isIntersecting && entry.intersectionRatio >= expandThreshold;
        if (!shouldExpand && this.expanded && entry.intersectionRatio > collapseThreshold) return;

        this.toggleExpansion(shouldExpand);
      },
      { rootMargin, threshold: [collapseThreshold, expandThreshold] },
    );

    this.observer.observe(trigger);

    this._resizeHandler = debounce(() => {
      this.cleanup();
      this.init();
    }, CONFIG.RESIZE_DEBOUNCE);
    globalThis.addEventListener('resize', this._resizeHandler, { passive: true });
  }

  toggleExpansion(shouldExpand) {
    const footer = dom.get('#site-footer');
    if (!footer) return;

    const min = footer.querySelector('.footer-minimized');
    const max = footer.querySelector('.footer-maximized');

    if (shouldExpand && !this.expanded) {
      if (this._collapseTimer) {
        clearTimeout(this._collapseTimer);
        this._collapseTimer = null;
      }
      scrollManager.create(1000);
      globalClose.bind();
      document.documentElement.style.scrollSnapType = 'none';
      footer.classList.add('footer-expanded');
      footer.setAttribute('aria-expanded', 'true');
      document.body.classList.add('footer-expanded');
      max?.classList.remove('footer-hidden');
      min?.classList.add('footer-hidden');
      // Remove tabindex and set inert instead of aria-hidden to prevent focus issues
      if (min) {
        min.setAttribute('inert', '');
        min.setAttribute('tabindex', '-1');
      }
      this.expanded = true;
      this._lockUntil = Date.now() + CONFIG.EXPAND_LOCK_MS;
      return;
    }

    if (!shouldExpand && this.expanded) {
      const delay = Math.max(0, this._lockUntil - Date.now()) + CONFIG.COLLAPSE_DEBOUNCE_MS;
      if (this._collapseTimer) clearTimeout(this._collapseTimer);
      this._collapseTimer = setTimeout(() => {
        footerManager.closeFooter();
        this.expanded = false;
        this._collapseTimer = null;
      }, delay);
    }
  }

  cleanup() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    if (this._resizeHandler) {
      globalThis.removeEventListener('resize', this._resizeHandler);
      this._resizeHandler = null;
    }
    if (this._collapseTimer) {
      clearTimeout(this._collapseTimer);
      this._collapseTimer = null;
    }
  }
}

class FooterLoader {
  async init() {
    const container = dom.get('#footer-container');
    const existingFooter = dom.get('#site-footer');

    if (existingFooter || container?.querySelector('#site-footer')) {
      this.setup();
      return true;
    }

    if (!container) return false;

    try {
      const response = await fetch(container.dataset.footerSrc || CONFIG.FOOTER_HTML_PATH);
      if (!response?.ok) throw new Error('Footer load failed');

      container.innerHTML = await response.text();
      dom.clear();
      this.setup();
      document.dispatchEvent(new CustomEvent('footer:loaded', { detail: { timestamp: Date.now() } }));
      return true;
    } catch (error) {
      log.error('Footer load failed', error);
      return false;
    }
  }

  setup() {
    this.updateYears();
    this.setupInteractions();
    consentBanner.init();
    new ScrollHandler().init();
  }

  updateYears() {
    const year = new Date().getFullYear();
    dom.getAll('.current-year').forEach((el) => (el.textContent = year));
  }

  setupInteractions() {
    const form = dom.get('.newsletter-form-enhanced');
    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = form.querySelector('#newsletter-email');
      if (input && !input.checkValidity()) {
        a11y?.announce('Bitte gültige E-Mail eingeben', { priority: 'assertive' });
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

    document.addEventListener('click', (e) => {
      // Check if click is on cookie trigger
      const cookieTrigger = e.target.closest('[data-cookie-trigger]');
      if (cookieTrigger) {
        e.preventDefault();
        e.stopPropagation();
        cookieSettings.open();
        return;
      }

      // Check if click is on minimized footer
      const footerMinClick = e.target.closest('.footer-minimized');
      if (footerMinClick) {
        // Check if click is on a real link (not footer nav buttons)
        const isLink = e.target.closest('a[href^="http"], a[href^="/"]');
        const isFormElement = e.target.closest('input, textarea, select');
        
        if (!isLink && !isFormElement) {
          e.preventDefault();
          globalThis.footerScrollHandler?.toggleExpansion(true);
        }
      }
    }, { passive: false });

    const showcaseBtn = dom.get('#threeShowcaseBtn');
    if (showcaseBtn && !showcaseBtn.dataset.init) {
      showcaseBtn.dataset.init = '1';
      showcaseBtn.addEventListener('click', () => {
        showcaseBtn.classList.add('active');
        document.dispatchEvent(new CustomEvent('three-earth:showcase', { detail: { duration: 8000 } }));
        setTimeout(() => showcaseBtn.classList.remove('active'), 8000);
      });
    }
  }
}

export const initFooter = () => new FooterLoader().init();
