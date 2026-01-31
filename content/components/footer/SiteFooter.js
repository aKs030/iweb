// @ts-check
/**
 * Modern Site Footer Web Component
 * Encapsulates footer logic, cookies, and analytics.
 * @version 1.0.0
 */

import { createLogger } from '/content/core/logger.js';
import { a11y } from '/content/core/accessibility-manager.js';

const log = createLogger('SiteFooter');

const CONFIG = {
  FOOTER_PATH: '/content/components/footer/footer.html',
  DEBOUNCE_MS: 150,
};

/**
 * @typedef {import('/content/core/types.js').FooterElements} FooterElements
 */

/**
 * Cookie Management Utility
 */
const CookieManager = {
  /**
   * @param {string} name
   * @param {string} value
   * @param {number} days
   */
  set(name, value, days = 365) {
    const date = new Date();
    date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
    const expires = `; expires=${date.toUTCString()}`;
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${name}=${value || ''}${expires}; path=/; SameSite=Lax${secure}`;
  },

  /**
   * @param {string} name
   * @returns {string|null}
   */
  get(name) {
    const nameEQ = `${name}=`;
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
      cookie = cookie.trim();
      if (cookie.startsWith(nameEQ)) {
        return cookie.substring(nameEQ.length);
      }
    }
    return null;
  },

  /**
   * @param {string} name
   */
  delete(name) {
    const domains = [
      '',
      window.location.hostname,
      `.${window.location.hostname}`,
    ];
    domains.forEach((domain) => {
      const domainPart = domain ? `; domain=${domain}` : '';
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/${domainPart}`;
    });
  },

  deleteAnalytics() {
    const analyticsCookies = ['_ga', '_gid', '_gat', '_gat_gtag_G_S0587RQ4CN'];
    analyticsCookies.forEach((name) => this.delete(name));
  },
};

/**
 * Analytics Manager
 */
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

  /**
   * @param {boolean} granted
   */
  updateConsent(granted) {
    const win = /** @type {import('/content/core/types.js').GlobalWindow} */ (
      window
    );
    if (typeof win.gtag !== 'function') return;
    const status = granted ? 'granted' : 'denied';
    try {
      win.gtag('consent', 'update', {
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

/**
 * SiteFooter Custom Element
 */
export class SiteFooter extends HTMLElement {
  constructor() {
    super();
    this.analytics = new Analytics();
    /** @type {IntersectionObserver|null} */
    this.observer = null;
    this.expanded = false;
    this.initialized = false;
    /** @type {FooterElements} */
    this.elements = {
      footer: null,
      footerMin: null,
      footerMax: null,
      cookieBanner: null,
      cookieSettings: null,
      footerContent: null,
      acceptBtn: null,
      rejectBtn: null,
      closeBtn: null,
      analyticsToggle: null,
      adsToggle: null,
      rejectAll: null,
      acceptSelected: null,
      acceptAll: null,
      newsletterForm: null,
    };
  }

  async connectedCallback() {
    // Allow for manual source override via attribute
    const src = this.getAttribute('src') || CONFIG.FOOTER_PATH;

    try {
      if (!this.innerHTML.trim()) {
        const response = await fetch(src);
        if (!response.ok) throw new Error('Footer load failed');
        this.innerHTML = await response.text();
      }

      this.init();
      this.initialized = true;
      log.info('Footer initialized');
      this.dispatchEvent(new CustomEvent('footer:loaded', { bubbles: true }));
    } catch (error) {
      log.error('Footer load failed', error);
    }
  }

  disconnectedCallback() {
    this.observer?.disconnect();
  }

  init() {
    // Cache DOM elements
    this.elements = {
      footer: this.querySelector('#site-footer'),
      footerMin: this.querySelector('.footer-min'),
      footerMax: this.querySelector('.footer-max'),
      cookieBanner: this.querySelector('#cookie-banner'),
      cookieSettings: this.querySelector('#cookie-settings'),
      footerContent: this.querySelector('#footer-content'),
      acceptBtn: this.querySelector('#accept-cookies'),
      rejectBtn: this.querySelector('#reject-cookies'),
      closeBtn: this.querySelector('#close-settings'),
      analyticsToggle: this.querySelector('#analytics-toggle'),
      adsToggle: this.querySelector('#ads-toggle'),
      rejectAll: this.querySelector('#reject-all'),
      acceptSelected: this.querySelector('#accept-selected'),
      acceptAll: this.querySelector('#accept-all'),
      newsletterForm: this.querySelector('.newsletter-form'),
    };

    this.setupDate();
    this.setupCookieBanner();
    this.setupScrollHandler();
    this.bindEvents();
  }

  setupDate() {
    const year = new Date().getFullYear(); // ✅ Create once, reuse
    this.querySelectorAll('.year').forEach(
      (el) => (el.textContent = String(year)),
    );
  }

  setupCookieBanner() {
    const { cookieBanner, acceptBtn, rejectBtn } = this.elements;

    if (!cookieBanner || !acceptBtn || !rejectBtn) return;

    const consent = CookieManager.get('cookie_consent');
    const shouldShow = consent !== 'accepted' && consent !== 'rejected';

    cookieBanner.classList.toggle('hidden', !shouldShow);

    if (consent === 'accepted') {
      this.analytics.updateConsent(true);
      this.analytics.load();
    } else if (consent === 'rejected') {
      this.analytics.updateConsent(false);
    }

    acceptBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.acceptCookies(cookieBanner);
    });

    rejectBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.rejectCookies(cookieBanner);
    });
  }

  /**
   * @param {HTMLElement} banner
   */
  acceptCookies(banner) {
    const styledBanner =
      /** @type {import('/content/core/types.js').StyledHTMLElement} */ (
        banner
      );
    styledBanner.style.animation = 'cookieSlideOut 0.3s ease-out forwards';
    setTimeout(() => banner.classList.add('hidden'), 300);

    CookieManager.set('cookie_consent', 'accepted');
    this.analytics.updateConsent(true);
    this.analytics.load();
    a11y?.announce('Cookies akzeptiert', { priority: 'polite' });
  }

  /**
   * @param {HTMLElement} banner
   */
  rejectCookies(banner) {
    const styledBanner =
      /** @type {import('/content/core/types.js').StyledHTMLElement} */ (
        banner
      );
    styledBanner.style.animation = 'cookieSlideOut 0.3s ease-out forwards';
    setTimeout(() => banner.classList.add('hidden'), 300);

    CookieManager.set('cookie_consent', 'rejected');
    this.analytics.updateConsent(false);
    a11y?.announce('Cookies abgelehnt', { priority: 'polite' });
  }

  setupScrollHandler() {
    const { footer } = this.elements;
    if (!footer) return;

    // Use existing trigger or create one
    let trigger = document.getElementById('footer-trigger-zone');
    if (!trigger) {
      trigger = document.createElement('div');
      trigger.id = 'footer-trigger-zone';
      trigger.style.cssText = 'height: 100px; pointer-events: none;';
      this.parentElement?.insertBefore(trigger, this);
    }

    this.observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && !this.expanded) {
          this.toggleFooter(true);
        } else if (!entry.isIntersecting && this.expanded) {
          this.toggleFooter(false);
        }
      },
      { threshold: 0.1 },
    );

    this.observer.observe(trigger);

    // Close on outside click
    document.addEventListener('click', (e) => {
      const target = /** @type {Element} */ (e.target);
      if (this.expanded && !target.closest('#site-footer')) {
        this.toggleFooter(false);
      }
    });
  }

  /**
   * @param {boolean} [forceState]
   */
  toggleFooter(forceState) {
    const { footer, footerMin, footerMax } = this.elements;

    if (!footer) return;

    const newState = forceState !== undefined ? forceState : !this.expanded;
    this.expanded = newState;

    if (this.expanded) {
      footer.classList.add('expanded');
      document.body.classList.add('footer-expanded');
      footerMin?.classList.add('hidden');
      footerMax?.classList.remove('hidden');
      footerMin?.setAttribute('aria-expanded', 'true');
    } else {
      footer.classList.remove('expanded');
      document.body.classList.remove('footer-expanded');
      footerMin?.classList.remove('hidden');
      footerMax?.classList.add('hidden');
      footerMin?.setAttribute('aria-expanded', 'false');
    }
  }

  openSettings() {
    const { cookieSettings, footerContent, analyticsToggle, adsToggle } =
      this.elements;

    if (!cookieSettings) return;

    // Load current settings
    const consent = CookieManager.get('cookie_consent');

    if (analyticsToggle) {
      const toggle = /** @type {HTMLInputElement} */ (analyticsToggle);
      toggle.checked = consent === 'accepted';
    }
    if (adsToggle) {
      const toggle = /** @type {HTMLInputElement} */ (adsToggle);
      toggle.checked = false;
    }

    // Force expand footer
    this.toggleFooter(true);

    cookieSettings.classList.remove('hidden');
    footerContent?.classList.add('hidden');
  }

  closeSettings() {
    const { cookieSettings, footerContent } = this.elements;

    cookieSettings?.classList.add('hidden');
    footerContent?.classList.remove('hidden');

    // Reset footer to normal state
    this.toggleFooter(false);
  }

  bindEvents() {
    const { closeBtn, footerMin, newsletterForm } = this.elements;

    // Cookie trigger buttons
    this.addEventListener('click', (e) => {
      const target = /** @type {Element} */ (e.target);
      if (target.closest('[data-cookie-trigger]')) {
        e.preventDefault();
        e.stopPropagation();
        this.openSettings();
      }
    });

    // Settings close button
    closeBtn?.addEventListener('click', () => this.closeSettings());

    // Footer minimize click
    footerMin?.addEventListener('click', (e) => {
      // Ignore clicks on interactive elements
      const target = /** @type {Element} */ (e.target);
      if (target.closest('a, button, input, .cookie-inline')) {
        return;
      }
      this.toggleFooter();
    });

    // Newsletter form
    newsletterForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      const form = /** @type {HTMLFormElement} */ (newsletterForm);
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

    // Cookie Settings Buttons
    this.bindSettingsButtons();
  }

  bindSettingsButtons() {
    const {
      rejectAll,
      acceptSelected,
      acceptAll,
      analyticsToggle,
      cookieBanner,
    } = this.elements;

    rejectAll?.addEventListener('click', () => {
      CookieManager.set('cookie_consent', 'rejected');
      CookieManager.deleteAnalytics();
      this.analytics.updateConsent(false);
      cookieBanner?.classList.add('hidden');
      a11y?.announce('Nur notwendige Cookies', { priority: 'polite' });
      this.closeSettings();
    });

    acceptSelected?.addEventListener('click', () => {
      const toggle = /** @type {HTMLInputElement|null} */ (analyticsToggle);
      const analyticsEnabled = toggle?.checked ?? false;
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

      cookieBanner?.classList.add('hidden');
      a11y?.announce('Einstellungen gespeichert', { priority: 'polite' });
      this.closeSettings();
    });

    acceptAll?.addEventListener('click', () => {
      CookieManager.set('cookie_consent', 'accepted');
      this.analytics.updateConsent(true);
      this.analytics.load();
      cookieBanner?.classList.add('hidden');
      a11y?.announce('Alle Cookies akzeptiert', { priority: 'polite' });
      this.closeSettings();
    });
  }
}

customElements.define('site-footer', SiteFooter);
