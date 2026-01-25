/**
 * Modern Footer App v10.0
 * Kompakt, optimiert, ES2024
 */

import { createLogger, CookieManager } from '/content/core/shared-utilities.js';
import { a11y } from '/content/core/accessibility-manager.js';

const log = createLogger('Footer');

// Config
const CONFIG = {
  FOOTER_PATH: '/content/components/footer/footer.html',
  DEBOUNCE_MS: 150,
};

// DOM Cache
class DOM {
  cache = new Map();

  get(selector) {
    if (selector.startsWith('#')) {
      return document.getElementById(selector.slice(1));
    }
    const cached = this.cache.get(selector);
    if (cached?.isConnected) return cached;
    const el = document.querySelector(selector);
    if (el) this.cache.set(selector, el);
    return el;
  }

  getAll(selector) {
    return [...document.querySelectorAll(selector)];
  }

  clear() {
    this.cache.clear();
  }
}

// Analytics Manager
class Analytics {
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

  updateConsent(granted) {
    if (typeof gtag !== 'function') return;
    const status = granted ? 'granted' : 'denied';
    try {
      gtag('consent', 'update', {
        ad_storage: status,
        analytics_storage: status,
        ad_user_data: status,
        ad_personalization: status,
      });
    } catch (e) {
      log.error('Consent update failed', e);
    }
  }
}

// Cookie Banner
class CookieBanner {
  constructor(dom, analytics) {
    this.dom = dom;
    this.analytics = analytics;
  }

  init() {
    const banner = this.dom.get('#cookie-banner');
    const acceptBtn = this.dom.get('#accept-cookies');
    const rejectBtn = this.dom.get('#reject-cookies');

    if (!banner || !acceptBtn) return;

    const consent = CookieManager.get('cookie_consent');
    const shouldShow = consent !== 'accepted' && consent !== 'rejected';

    banner.classList.toggle('hidden', !shouldShow);

    if (consent === 'accepted') {
      this.analytics.updateConsent(true);
      this.analytics.load();
    } else if (consent === 'rejected') {
      this.analytics.updateConsent(false);
    }

    acceptBtn.onclick = (e) => {
      e.stopPropagation();
      this.accept();
    };
    rejectBtn.onclick = (e) => {
      e.stopPropagation();
      this.reject();
    };
  }

  accept() {
    const banner = this.dom.get('#cookie-banner');
    if (banner) {
      banner.style.animation = 'cookieSlideOut 0.3s ease-out forwards';
      setTimeout(() => banner.classList.add('hidden'), 300);
    }
    CookieManager.set('cookie_consent', 'accepted');
    this.analytics.updateConsent(true);
    this.analytics.load();
    a11y?.announce('Cookies akzeptiert', { priority: 'polite' });
  }

  reject() {
    const banner = this.dom.get('#cookie-banner');
    if (banner) {
      banner.style.animation = 'cookieSlideOut 0.3s ease-out forwards';
      setTimeout(() => banner.classList.add('hidden'), 300);
    }
    CookieManager.set('cookie_consent', 'rejected');
    this.analytics.updateConsent(false);
    a11y?.announce('Cookies abgelehnt', { priority: 'polite' });
  }
}

// Cookie Settings
class CookieSettings {
  constructor(dom, analytics) {
    this.dom = dom;
    this.analytics = analytics;
  }

  open() {
    const settings = this.dom.get('#cookie-settings');
    const content = this.dom.get('#footer-content');
    const footer = this.dom.get('#site-footer');
    const footerMin = this.dom.get('.footer-min');
    const footerMax = this.dom.get('.footer-max');

    if (!settings) return;

    // Load current settings
    const consent = CookieManager.get('cookie_consent');
    const analyticsToggle = this.dom.get('#analytics-toggle');
    const adsToggle = this.dom.get('#ads-toggle');

    if (analyticsToggle) analyticsToggle.checked = consent === 'accepted';
    if (adsToggle) adsToggle.checked = false;

    // Zeige maximierten Footer mit Cookie-Einstellungen
    footer?.classList.add('expanded');
    document.body.classList.add('footer-expanded');
    footerMin?.classList.add('hidden');
    footerMax?.classList.remove('hidden');

    settings.classList.remove('hidden');
    content?.classList.add('hidden');

    this.bindEvents();
  }

  close() {
    const settings = this.dom.get('#cookie-settings');
    const content = this.dom.get('#footer-content');
    const footer = this.dom.get('#site-footer');
    const footerMin = this.dom.get('.footer-min');
    const footerMax = this.dom.get('.footer-max');

    settings?.classList.add('hidden');
    content?.classList.remove('hidden');

    // Schließe Footer komplett
    footer?.classList.remove('expanded');
    document.body.classList.remove('footer-expanded');
    footerMin?.classList.remove('hidden');
    footerMax?.classList.add('hidden');
  }

  bindEvents() {
    const closeBtn = this.dom.get('#close-settings');
    const rejectAll = this.dom.get('#reject-all');
    const acceptSelected = this.dom.get('#accept-selected');
    const acceptAll = this.dom.get('#accept-all');

    closeBtn.onclick = () => this.close();

    rejectAll.onclick = () => {
      CookieManager.set('cookie_consent', 'rejected');
      CookieManager.deleteAnalytics();
      this.analytics.updateConsent(false);
      this.dom.get('#cookie-banner')?.classList.add('hidden');
      a11y?.announce('Nur notwendige Cookies', { priority: 'polite' });
      this.close();
    };

    acceptSelected.onclick = () => {
      const analyticsEnabled = this.dom.get('#analytics-toggle')?.checked;
      CookieManager.set(
        'cookie_consent',
        analyticsEnabled ? 'accepted' : 'rejected',
      );

      if (analyticsEnabled) {
        this.analytics.updateConsent(true);
        this.analytics.load();
      } else {
        this.analytics.updateConsent(false);
        CookieManager.deleteAnalytics();
      }

      this.dom.get('#cookie-banner')?.classList.add('hidden');
      a11y?.announce('Einstellungen gespeichert', { priority: 'polite' });
      this.close();
    };

    acceptAll.onclick = () => {
      CookieManager.set('cookie_consent', 'accepted');
      this.analytics.updateConsent(true);
      this.analytics.load();
      this.dom.get('#cookie-banner')?.classList.add('hidden');
      a11y?.announce('Alle Cookies akzeptiert', { priority: 'polite' });
      this.close();
    };
  }
}

// Footer Manager
class FooterManager {
  constructor(dom) {
    this.dom = dom;
    this.expanded = false;
  }

  toggle() {
    const footer = this.dom.get('#site-footer');
    const min = this.dom.get('.footer-min');
    const max = this.dom.get('.footer-max');

    if (!footer) return;

    this.expanded = !this.expanded;

    if (this.expanded) {
      footer.classList.add('expanded');
      document.body.classList.add('footer-expanded');
      min?.classList.add('hidden');
      max?.classList.remove('hidden');
      min?.setAttribute('aria-expanded', 'true');
    } else {
      footer.classList.remove('expanded');
      document.body.classList.remove('footer-expanded');
      min?.classList.remove('hidden');
      max?.classList.add('hidden');
      min?.setAttribute('aria-expanded', 'false');
    }
  }

  close() {
    if (!this.expanded) return;
    this.toggle();
  }
}

// Scroll Handler
class ScrollHandler {
  constructor(dom, footerManager) {
    this.dom = dom;
    this.footerManager = footerManager;
    this.observer = null;
  }

  init() {
    const footer = this.dom.get('#site-footer');
    if (!footer) return;

    // Create trigger zone
    let trigger = this.dom.get('#footer-trigger');
    if (!trigger) {
      trigger = document.createElement('div');
      trigger.id = 'footer-trigger';
      trigger.style.cssText = 'height: 100px; pointer-events: none;';
      footer.parentNode.insertBefore(trigger, footer);
    }

    // Intersection Observer
    this.observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && !this.footerManager.expanded) {
          this.footerManager.toggle();
        } else if (!entry.isIntersecting && this.footerManager.expanded) {
          this.footerManager.close();
        }
      },
      { threshold: 0.1 },
    );

    this.observer.observe(trigger);

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (this.footerManager.expanded && !e.target.closest('#site-footer')) {
        this.footerManager.close();
      }
    });
  }

  cleanup() {
    this.observer?.disconnect();
  }
}

// Main Footer Loader
class FooterLoader {
  constructor() {
    this.dom = new DOM();
    this.analytics = new Analytics();
    this.banner = new CookieBanner(this.dom, this.analytics);
    this.settings = new CookieSettings(this.dom, this.analytics);
    this.footerManager = new FooterManager(this.dom);
    this.scrollHandler = new ScrollHandler(this.dom, this.footerManager);
  }

  async init() {
    const container = this.dom.get('#footer-container');
    const existing = this.dom.get('#site-footer');

    if (existing) {
      this.setup();
      return true;
    }

    if (!container) return false;

    try {
      const response = await fetch(
        container.dataset.footerSrc || CONFIG.FOOTER_PATH,
      );
      if (!response.ok) throw new Error('Footer load failed');

      container.innerHTML = await response.text();
      this.dom.clear();
      this.setup();

      log.info('Footer loaded');
      return true;
    } catch (error) {
      log.error('Footer load failed', error);
      return false;
    }
  }

  setup() {
    this.updateYear();
    this.banner.init();
    this.scrollHandler.init();
    this.bindEvents();
  }

  updateYear() {
    const year = new Date().getFullYear();
    this.dom.getAll('.year').forEach((el) => (el.textContent = year));
  }

  bindEvents() {
    // Cookie trigger buttons
    document.addEventListener('click', (e) => {
      if (e.target.closest('[data-cookie-trigger]')) {
        e.preventDefault();
        e.stopPropagation();
        this.settings.open();
      }
    });

    // Footer minimize click
    const footerMin = this.dom.get('.footer-min');
    footerMin?.addEventListener('click', (e) => {
      // Ignoriere Clicks auf interaktive Elemente
      if (e.target.closest('a, button, input, .cookie-inline')) {
        return;
      }
      this.footerManager.toggle();
    });

    // Newsletter form
    const form = this.dom.get('.newsletter-form');
    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      const btn = form.querySelector('button');
      if (btn) {
        const original = btn.textContent;
        btn.textContent = '✓';
        btn.disabled = true;
        setTimeout(() => {
          btn.textContent = original;
          btn.disabled = false;
        }, 2000);
      }
      form.reset();
      a11y?.announce('Newsletter abonniert', { priority: 'polite' });
    });
  }
}

// Export
export const initFooter = () => new FooterLoader().init();
