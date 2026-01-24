/**
 * Modern Footer App - Kompakte ES2024 Version
 * @version 3.0.0
 */

import {
  createLogger,
  CookieManager,
  debounce,
  getElementById,
} from '/content/utils/shared-utilities.js';
import { a11y } from '/content/utils/accessibility-manager.js';

const log = createLogger('FooterApp');

// ===== Configuration =====
const CONFIG = {
  SCROLL_MARK_DURATION: 1000,
  RESIZE_DEBOUNCE: 120,
  EXPAND_LOCK_MS: 800,
  COLLAPSE_DEBOUNCE_MS: 200,
  FOOTER_HTML_PATH: '/content/components/footer/footer.html',
};

// ===== Modern DOM Cache =====
class DOMCache {
  #cache = new Map();

  get(selector, parent = document) {
    if (
      selector.startsWith('#') &&
      !selector.includes(' ') &&
      parent === document
    ) {
      return getElementById(selector.slice(1));
    }

    const key = `${selector}-${parent === document ? 'doc' : 'parent'}`;
    const cached = this.#cache.get(key);
    if (cached?.isConnected) return cached;

    const element = parent.querySelector(selector);
    if (element) this.#cache.set(key, element);
    return element;
  }

  getAll(selector) {
    const key = `all-${selector}`;
    const cached = this.#cache.get(key);
    if (cached?.length && cached.every((el) => el.isConnected)) return cached;

    const elements = [...document.querySelectorAll(selector)];
    if (elements.length) this.#cache.set(key, elements);
    return elements;
  }

  clear() {
    this.#cache.clear();
  }
}

// ===== Scroll Manager =====
class ScrollManager {
  #activeToken = null;
  #timer = null;

  create(duration = CONFIG.SCROLL_MARK_DURATION) {
    this.#timer && clearTimeout(this.#timer);
    const token = Symbol('scroll');
    this.#activeToken = token;

    if (duration > 0) {
      this.#timer = setTimeout(() => {
        if (this.#activeToken === token) this.#activeToken = null;
        this.#timer = null;
      }, duration);
    }

    return token;
  }

  clear() {
    this.#activeToken = null;
    this.#timer && clearTimeout(this.#timer);
    this.#timer = null;
  }

  hasActive() {
    return !!this.#activeToken;
  }
}

// ===== Global Close Handler =====
class GlobalCloseHandler {
  #closeHandler = null;
  #abortController = null;

  setCloseHandler(fn) {
    this.#closeHandler = fn;
  }

  #onDocClick = (e) => {
    const footer = this.dom.get('#site-footer');
    if (!footer?.classList.contains('footer-expanded')) return;
    if (e.target.closest('#site-footer')) return;
    this.#closeHandler?.();
  };

  #onUserScroll = () => {
    if (this.scrollManager.hasActive()) return;
    const footer = this.dom.get('#site-footer');
    if (!footer?.classList.contains('footer-expanded')) return;
    this.#closeHandler?.();
  };

  bind(dom, scrollManager) {
    this.dom = dom;
    this.scrollManager = scrollManager;

    if (this.#abortController) return;

    this.#abortController = new AbortController();
    const { signal } = this.#abortController;
    const isMobile = window.matchMedia('(max-width: 768px)').matches;

    if (isMobile) {
      window.addEventListener('scroll', this.#onUserScroll, {
        passive: true,
        signal,
      });
      window.addEventListener('touchmove', this.#onUserScroll, {
        passive: true,
        signal,
      });
    } else {
      document.addEventListener('click', this.#onDocClick, {
        capture: true,
        passive: true,
        signal,
      });
      window.addEventListener('wheel', this.#onUserScroll, {
        passive: true,
        signal,
      });
    }
  }

  unbind() {
    this.#abortController?.abort();
    this.#abortController = null;
  }
}

// ===== Analytics Manager =====
class AnalyticsManager {
  load() {
    document
      .querySelectorAll('script[data-consent="required"]')
      .forEach((script) => {
        const newScript = document.createElement('script');

        for (const attr of script.attributes) {
          const name = attr.name === 'data-src' ? 'src' : attr.name;
          if (!['data-consent', 'type'].includes(attr.name)) {
            newScript.setAttribute(name, attr.value);
          }
        }

        if (script.innerHTML.trim()) newScript.innerHTML = script.innerHTML;
        script.replaceWith(newScript);
      });

    log.info('Analytics loaded');
  }

  updateConsent(input = true) {
    if (typeof gtag !== 'function') return;

    const status = (val) => (val ? 'granted' : 'denied');
    const payload =
      typeof input === 'boolean'
        ? {
            ad_storage: status(input),
            analytics_storage: status(input),
            ad_user_data: status(input),
            ad_personalization: status(input),
          }
        : {
            ad_storage: input.ad_storage ?? status(input.granted),
            analytics_storage: input.analytics_storage ?? status(input.granted),
            ad_user_data: input.ad_user_data ?? status(input.granted),
            ad_personalization:
              input.ad_personalization ?? status(input.granted),
          };

    try {
      gtag('consent', 'update', payload);
    } catch {
      // Ignore
    }
  }
}

// ===== Consent Banner Manager =====
class ConsentBannerManager {
  #handlers = new Map();
  #dom = null;
  #analytics = null;

  constructor(dom, analytics) {
    this.#dom = dom;
    this.#analytics = analytics;
  }

  init() {
    const banner = this.#dom.get('#cookie-consent-banner');
    const acceptBtn = this.#dom.get('#accept-cookies-btn');
    const rejectBtn = this.#dom.get('#reject-cookies-btn');

    if (!banner || !acceptBtn) return;

    const consent = CookieManager.get('cookie_consent');
    banner.classList.toggle(
      'hidden',
      consent === 'accepted' || consent === 'rejected',
    );

    if (consent === 'accepted') {
      this.#analytics.updateConsent(true);
      this.#analytics.load();
    } else if (consent === 'rejected') {
      this.#analytics.updateConsent(false);
    }

    this.#cleanup();

    const acceptHandler = () => this.#accept();
    const rejectHandler = () => this.#reject();

    acceptBtn.addEventListener('click', acceptHandler);
    rejectBtn?.addEventListener('click', rejectHandler);

    this.#handlers.set('accept', {
      element: acceptBtn,
      handler: acceptHandler,
    });
    if (rejectBtn)
      this.#handlers.set('reject', {
        element: rejectBtn,
        handler: rejectHandler,
      });
  }

  #cleanup() {
    this.#handlers.forEach(({ element, handler }) => {
      element?.removeEventListener('click', handler);
    });
    this.#handlers.clear();
  }

  #accept() {
    this.#dom.get('#cookie-consent-banner')?.classList.add('hidden');
    CookieManager.set('cookie_consent', 'accepted');
    (globalThis.dataLayer = globalThis.dataLayer || []).push({
      event: 'consentGranted',
    });
    this.#analytics.updateConsent(true);
    this.#analytics.load();
    a11y?.announce('Alle Cookies akzeptiert', { priority: 'polite' });
  }

  #reject() {
    this.#dom.get('#cookie-consent-banner')?.classList.add('hidden');
    CookieManager.set('cookie_consent', 'rejected');
    a11y?.announce('Nur notwendige Cookies akzeptiert', { priority: 'polite' });
  }
}

// ===== Cookie Settings Manager =====
class CookieSettingsManager {
  #elements = null;
  #handlers = new Map();
  #dom = null;
  #analytics = null;
  #scrollManager = null;
  #globalClose = null;
  #footerManager = null;

  constructor(dom, analytics, scrollManager, globalClose) {
    this.#dom = dom;
    this.#analytics = analytics;
    this.#scrollManager = scrollManager;
    this.#globalClose = globalClose;
  }

  setFooterManager(footerManager) {
    this.#footerManager = footerManager;
  }

  #getElements() {
    return {
      footer: this.#dom.get('#site-footer'),
      cookieView: this.#dom.get('#footer-cookie-view'),
      normalContent: this.#dom.get('#footer-normal-content'),
      analyticsToggle: this.#dom.get('#footer-analytics-toggle'),
      adPersonalizationToggle: this.#dom.get(
        '#footer-ad-personalization-toggle',
      ),
      closeBtn: this.#dom.get('#close-cookie-footer'),
      rejectAllBtn: this.#dom.get('#footer-reject-all'),
      acceptSelectedBtn: this.#dom.get('#footer-accept-selected'),
      acceptAllBtn: this.#dom.get('#footer-accept-all'),
      triggerBtn: this.#dom.get('#footer-cookies-link'),
    };
  }

  open() {
    this.#elements = this.#getElements();
    const { footer, cookieView, normalContent, analyticsToggle, triggerBtn } =
      this.#elements;

    if (!footer || !cookieView) return;

    if (analyticsToggle) {
      analyticsToggle.checked =
        CookieManager.get('cookie_consent') === 'accepted';
    }

    document.documentElement.style.scrollSnapType = 'none';
    footer.classList.add('footer-expanded');
    document.body.classList.add('footer-expanded');

    const maxEl = footer.querySelector('.footer-maximized');
    const minEl = footer.querySelector('.footer-minimized');

    maxEl?.classList.remove('footer-hidden');
    if (minEl) {
      minEl.classList.add('footer-hidden');
      minEl.setAttribute('inert', '');
      minEl.setAttribute('tabindex', '-1');
    }

    if (globalThis.footerScrollHandler) {
      globalThis.footerScrollHandler.expanded = true;
    }

    cookieView.classList.remove('hidden');
    if (normalContent) normalContent.style.display = 'none';
    triggerBtn?.setAttribute('aria-expanded', 'true');
    footer.setAttribute('aria-expanded', 'true');

    requestAnimationFrame(() => {
      globalThis.scrollTo({
        top: document.body.scrollHeight,
        behavior: 'smooth',
      });
    });

    this.#scrollManager.create(CONFIG.SCROLL_MARK_DURATION);
    this.#globalClose.bind(this.#dom, this.#scrollManager);
    a11y?.trapFocus(cookieView);

    this.#bindEvents();
    this.#loadToggles();
  }

  close() {
    if (!this.#elements) this.#elements = this.#getElements();
    const { cookieView, normalContent, triggerBtn } = this.#elements;

    cookieView?.classList.add('hidden');
    if (normalContent) normalContent.style.display = 'block';
    triggerBtn?.setAttribute('aria-expanded', 'false');

    this.#cleanup();
    this.#footerManager?.closeFooter();
  }

  #bindEvents() {
    const { closeBtn, rejectAllBtn, acceptSelectedBtn, acceptAllBtn } =
      this.#elements;
    const hideBanner = () =>
      this.#dom.get('#cookie-consent-banner')?.classList.add('hidden');

    this.#cleanup();

    const handlers = {
      close: () => this.close(),
      rejectAll: () => {
        CookieManager.set('cookie_consent', 'rejected');
        CookieManager.set(
          'cookie_consent_detail',
          JSON.stringify({
            analytics: false,
            ad_personalization: false,
          }),
        );
        CookieManager.deleteAnalytics();
        this.#analytics.updateConsent(false);
        a11y?.announce('Nur notwendige Cookies aktiv', { priority: 'polite' });
        this.close();
        hideBanner();
      },
      acceptSelected: () => {
        const analyticsEnabled = !!this.#elements.analyticsToggle?.checked;
        const adPersonalizationEnabled =
          !!this.#elements.adPersonalizationToggle?.checked;
        const detail = {
          analytics: analyticsEnabled,
          ad_personalization: adPersonalizationEnabled,
        };

        CookieManager.set('cookie_consent_detail', JSON.stringify(detail));
        CookieManager.set(
          'cookie_consent',
          analyticsEnabled || adPersonalizationEnabled
            ? 'accepted'
            : 'rejected',
        );

        (globalThis.dataLayer = globalThis.dataLayer || []).push({
          event: 'consentGranted',
          detail,
        });

        this.#analytics.updateConsent({
          analytics_storage: analyticsEnabled ? 'granted' : 'denied',
          ad_storage: adPersonalizationEnabled ? 'granted' : 'denied',
          ad_user_data: adPersonalizationEnabled ? 'granted' : 'denied',
          ad_personalization: adPersonalizationEnabled ? 'granted' : 'denied',
        });

        analyticsEnabled
          ? this.#analytics.load()
          : CookieManager.deleteAnalytics();
        a11y?.announce(
          analyticsEnabled ? 'Analyse aktiviert' : 'Analyse deaktiviert',
          { priority: 'polite' },
        );
        this.close();
        hideBanner();
      },
      acceptAll: () => {
        CookieManager.set('cookie_consent', 'accepted');
        CookieManager.set(
          'cookie_consent_detail',
          JSON.stringify({
            analytics: true,
            ad_personalization: true,
          }),
        );

        (globalThis.dataLayer = globalThis.dataLayer || []).push({
          event: 'consentGranted',
          detail: { analytics: true, ad_personalization: true },
        });

        this.#analytics.updateConsent({
          analytics_storage: 'granted',
          ad_storage: 'granted',
          ad_user_data: 'granted',
          ad_personalization: 'granted',
        });

        this.#analytics.load();
        a11y?.announce('Alle Cookies aktiviert', { priority: 'polite' });
        this.close();
        hideBanner();
      },
    };

    closeBtn?.addEventListener('click', handlers.close);
    rejectAllBtn?.addEventListener('click', handlers.rejectAll);
    acceptSelectedBtn?.addEventListener('click', handlers.acceptSelected);
    acceptAllBtn?.addEventListener('click', handlers.acceptAll);

    this.#handlers.set('close', { element: closeBtn, handler: handlers.close });
    this.#handlers.set('rejectAll', {
      element: rejectAllBtn,
      handler: handlers.rejectAll,
    });
    this.#handlers.set('acceptSelected', {
      element: acceptSelectedBtn,
      handler: handlers.acceptSelected,
    });
    this.#handlers.set('acceptAll', {
      element: acceptAllBtn,
      handler: handlers.acceptAll,
    });
  }

  #cleanup() {
    this.#handlers.forEach(({ element, handler }) => {
      element?.removeEventListener('click', handler);
    });
    this.#handlers.clear();
  }

  #loadToggles() {
    try {
      const detail = JSON.parse(
        CookieManager.get('cookie_consent_detail') || '{}',
      );
      const { analyticsToggle, adPersonalizationToggle } = this.#elements;

      if (analyticsToggle) analyticsToggle.checked = !!detail.analytics;
      if (adPersonalizationToggle)
        adPersonalizationToggle.checked = !!detail.ad_personalization;
    } catch {
      // Ignore
    }
  }
}

// ===== Footer Manager =====
class FooterManager {
  #dom = null;

  constructor(dom) {
    this.#dom = dom;
  }

  closeFooter() {
    const footer = this.#dom.get('#site-footer');
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

    const normal = this.#dom.get('#footer-normal-content');
    if (normal) normal.style.display = 'block';

    this.#dom.get('#footer-cookie-view')?.classList.add('hidden');
    document.documentElement.style.removeProperty('scroll-snap-type');

    if (globalThis.footerScrollHandler) {
      globalThis.footerScrollHandler.expanded = false;
    }

    a11y?.releaseFocus();
  }
}

// ===== Scroll Handler =====
class ScrollHandler {
  expanded = false;
  #observer = null;
  #resizeHandler = null;
  #collapseTimer = null;
  #lockUntil = 0;
  #dom = null;
  #scrollManager = null;
  #globalClose = null;
  #footerManager = null;

  constructor(dom, scrollManager, globalClose, footerManager) {
    this.#dom = dom;
    this.#scrollManager = scrollManager;
    this.#globalClose = globalClose;
    this.#footerManager = footerManager;
    globalThis.footerScrollHandler = this;
  }

  init() {
    const footer = this.#dom.get('#site-footer');
    let trigger = this.#dom.get('#footer-trigger-zone');

    if (!trigger) {
      trigger = document.createElement('div');
      trigger.id = 'footer-trigger-zone';
      trigger.className = 'footer-trigger-zone';
      trigger.setAttribute('aria-hidden', 'true');
      Object.assign(trigger.style, {
        pointerEvents: 'none',
        minHeight: '96px',
        width: '100%',
      });
      (footer?.parentNode || document.body).insertBefore(
        trigger,
        footer || null,
      );
      this.#dom.clear();
    }

    if (!footer || !trigger) return;

    const minEl = footer.querySelector('.footer-minimized');
    const maxEl = footer.querySelector('.footer-maximized');

    minEl?.classList.remove('footer-hidden');
    maxEl?.classList.add('footer-hidden');

    if (minEl) {
      minEl.removeAttribute('inert');
      minEl.setAttribute('tabindex', '0');
    }

    const isDesktop = window.matchMedia('(min-width: 769px)').matches;
    const expandThreshold = isDesktop ? 0.003 : 0.05;
    const collapseThreshold = isDesktop ? 0.001 : 0.02;
    const rootMargin = isDesktop ? '0px 0px -2% 0px' : '0px 0px -10% 0px';

    this.#observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (
          !entry ||
          (!entry.isIntersecting && this.#scrollManager.hasActive())
        )
          return;

        const shouldExpand =
          entry.isIntersecting && entry.intersectionRatio >= expandThreshold;
        if (
          !shouldExpand &&
          this.expanded &&
          entry.intersectionRatio > collapseThreshold
        )
          return;

        this.#toggleExpansion(shouldExpand);
      },
      { rootMargin, threshold: [collapseThreshold, expandThreshold] },
    );

    this.#observer.observe(trigger);

    this.#resizeHandler = debounce(() => {
      this.cleanup();
      this.init();
    }, CONFIG.RESIZE_DEBOUNCE);

    window.addEventListener('resize', this.#resizeHandler, { passive: true });
  }

  #toggleExpansion(shouldExpand) {
    const footer = this.#dom.get('#site-footer');
    if (!footer) return;

    const min = footer.querySelector('.footer-minimized');
    const max = footer.querySelector('.footer-maximized');

    if (shouldExpand && !this.expanded) {
      if (this.#collapseTimer) {
        clearTimeout(this.#collapseTimer);
        this.#collapseTimer = null;
      }

      this.#scrollManager.create(1000);
      this.#globalClose.bind(this.#dom, this.#scrollManager);
      document.documentElement.style.scrollSnapType = 'none';
      footer.classList.add('footer-expanded');
      footer.setAttribute('aria-expanded', 'true');
      document.body.classList.add('footer-expanded');
      max?.classList.remove('footer-hidden');
      min?.classList.add('footer-hidden');

      if (min) {
        min.setAttribute('inert', '');
        min.setAttribute('tabindex', '-1');
      }

      this.expanded = true;
      this.#lockUntil = Date.now() + CONFIG.EXPAND_LOCK_MS;
      return;
    }

    if (!shouldExpand && this.expanded) {
      const delay =
        Math.max(0, this.#lockUntil - Date.now()) + CONFIG.COLLAPSE_DEBOUNCE_MS;

      if (this.#collapseTimer) clearTimeout(this.#collapseTimer);

      this.#collapseTimer = setTimeout(() => {
        this.#footerManager.closeFooter();
        this.#globalClose.unbind();
        this.expanded = false;
        this.#collapseTimer = null;
      }, delay);
    }
  }

  toggleExpansion(shouldExpand) {
    this.#toggleExpansion(shouldExpand);
  }

  cleanup() {
    this.#observer?.disconnect();
    this.#observer = null;

    if (this.#resizeHandler) {
      window.removeEventListener('resize', this.#resizeHandler);
      this.#resizeHandler = null;
    }

    if (this.#collapseTimer) {
      clearTimeout(this.#collapseTimer);
      this.#collapseTimer = null;
    }
  }
}

// ===== Footer Loader =====
class FooterLoader {
  #dom = null;
  #analytics = null;
  #consentBanner = null;
  #cookieSettings = null;
  #footerManager = null;
  #scrollHandler = null;

  constructor() {
    this.#dom = new DOMCache();
    this.#analytics = new AnalyticsManager();

    const scrollManager = new ScrollManager();
    const globalClose = new GlobalCloseHandler();

    this.#consentBanner = new ConsentBannerManager(this.#dom, this.#analytics);
    this.#cookieSettings = new CookieSettingsManager(
      this.#dom,
      this.#analytics,
      scrollManager,
      globalClose,
    );
    this.#footerManager = new FooterManager(this.#dom);
    this.#scrollHandler = new ScrollHandler(
      this.#dom,
      scrollManager,
      globalClose,
      this.#footerManager,
    );

    this.#cookieSettings.setFooterManager(this.#footerManager);
    globalClose.setCloseHandler(() => this.#cookieSettings.close());
  }

  async init() {
    const container = this.#dom.get('#footer-container');
    const existingFooter = this.#dom.get('#site-footer');

    if (existingFooter || container?.querySelector('#site-footer')) {
      this.#setup();
      return true;
    }

    if (!container) return false;

    try {
      const response = await fetch(
        container.dataset.footerSrc || CONFIG.FOOTER_HTML_PATH,
      );
      if (!response?.ok) throw new Error('Footer load failed');

      container.innerHTML = await response.text();
      this.#dom.clear();
      this.#setup();

      document.dispatchEvent(
        new CustomEvent('footer:loaded', {
          detail: { timestamp: Date.now() },
        }),
      );

      return true;
    } catch (error) {
      log.error('Footer load failed', error);
      return false;
    }
  }

  #setup() {
    this.#updateYears();
    this.#setupInteractions();
    this.#consentBanner.init();
    this.#scrollHandler.init();
  }

  #updateYears() {
    const year = new Date().getFullYear();
    this.#dom.getAll('.current-year').forEach((el) => (el.textContent = year));
  }

  #setupInteractions() {
    const form = this.#dom.get('.newsletter-form-enhanced');

    form?.addEventListener('submit', (e) => {
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

    document.addEventListener(
      'click',
      (e) => {
        const cookieTrigger = e.target.closest('[data-cookie-trigger]');
        if (cookieTrigger) {
          e.preventDefault();
          e.stopPropagation();
          this.#cookieSettings.open();
          return;
        }

        const footerMinClick = e.target.closest('.footer-minimized');
        if (footerMinClick) {
          const isLink = e.target.closest('a[href^="http"], a[href^="/"]');
          const isFormElement = e.target.closest('input, textarea, select');

          if (!isLink && !isFormElement) {
            e.preventDefault();
            this.#scrollHandler.toggleExpansion(true);
          }
        }
      },
      { passive: false },
    );

    const showcaseBtn = this.#dom.get('#threeShowcaseBtn');
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
