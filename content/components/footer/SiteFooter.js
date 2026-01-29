// @ts-check
/**
 * Modern Site Footer Web Component
 * Encapsulates footer logic, cookies, and analytics.
 * @version 1.0.0
 */

import { createLogger } from '/content/core/logger.js';
import { a11y } from '/content/core/accessibility-manager.js';
import footerHtml from './footer.html?raw';
import footerStyles from './footer-css.js';

const log = createLogger('SiteFooter');

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
    // Scripts are in Light DOM (head-inline.js etc), but we might have scripts inside footer?
    // footer.html doesn't seem to have scripts.
    // But if there were any consent scripts in document, we might need to handle them.
    // The original code queried document.querySelectorAll('script[data-consent="required"]').
    // This assumes they are in Light DOM.
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
    // @ts-ignore
    if (typeof gtag !== 'function') return;
    const status = granted ? 'granted' : 'denied';
    try {
      // @ts-ignore
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

/**
 * SiteFooter Custom Element
 */
export class SiteFooter extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.analytics = new Analytics();
    this.observer = null;
    this.expanded = false;
    this.initialized = false;
  }

  async connectedCallback() {
    if (this.initialized) return;

    try {
      this.injectStyles();
      this.renderContent();

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

  injectStyles() {
    // eslint-disable-next-line no-undef
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(footerStyles);
    // @ts-ignore
    this.shadowRoot.adoptedStyleSheets = [sheet];
  }

  renderContent() {
    // Strip the outer <footer ...> and </footer> to just get the inner content
    // This allows :host to act as the container
    const content = footerHtml
      .replace(/<footer[^>]*>/i, '')
      .replace(/<\/footer>/i, '');

    // @ts-ignore
    this.shadowRoot.innerHTML = content;
  }

  init() {
    this.setupDate();
    this.setupCookieBanner();
    this.setupScrollHandler();
    this.bindEvents();
  }

  setupDate() {
    const year = new Date().getFullYear();
    // @ts-ignore
    this.shadowRoot.querySelectorAll('.year').forEach((el) => (el.textContent = String(year)));
  }

  setupCookieBanner() {
    // @ts-ignore
    const banner = this.shadowRoot.querySelector('#cookie-banner');
    // @ts-ignore
    const acceptBtn = this.shadowRoot.querySelector('#accept-cookies');
    // @ts-ignore
    const rejectBtn = this.shadowRoot.querySelector('#reject-cookies');

    if (!banner || !acceptBtn || !rejectBtn) return;

    const consent = CookieManager.get('cookie_consent');
    const shouldShow = consent !== 'accepted' && consent !== 'rejected';

    banner.classList.toggle('hidden', !shouldShow);

    if (consent === 'accepted') {
      this.analytics.updateConsent(true);
      this.analytics.load();
    } else if (consent === 'rejected') {
      this.analytics.updateConsent(false);
    }

    acceptBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.acceptCookies(banner);
    });

    rejectBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.rejectCookies(banner);
    });
  }

  /**
   * @param {Element} banner
   */
  acceptCookies(banner) {
    // @ts-ignore
    banner.style.animation = 'cookieSlideOut 0.3s ease-out forwards';
    setTimeout(() => banner.classList.add('hidden'), 300);

    CookieManager.set('cookie_consent', 'accepted');
    this.analytics.updateConsent(true);
    this.analytics.load();
    a11y?.announce('Cookies akzeptiert', { priority: 'polite' });
  }

  /**
   * @param {Element} banner
   */
  rejectCookies(banner) {
    // @ts-ignore
    banner.style.animation = 'cookieSlideOut 0.3s ease-out forwards';
    setTimeout(() => banner.classList.add('hidden'), 300);

    CookieManager.set('cookie_consent', 'rejected');
    this.analytics.updateConsent(false);
    a11y?.announce('Cookies abgelehnt', { priority: 'polite' });
  }

  setupScrollHandler() {
    // We don't query #site-footer anymore because :host is the footer

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
      // Check if click is outside the host
      // @ts-ignore
      const isInside = e.target === this || (this.contains && this.contains(e.target));
      if (this.expanded && !isInside) {
        this.toggleFooter(false);
      }
    });
  }

  /**
   * @param {boolean} [forceState]
   */
  toggleFooter(forceState) {
    // @ts-ignore
    const min = this.shadowRoot.querySelector('.footer-min');
    // @ts-ignore
    const max = this.shadowRoot.querySelector('.footer-max');

    const newState = forceState !== undefined ? forceState : !this.expanded;
    this.expanded = newState;

    if (this.expanded) {
      this.classList.add('expanded');

      // Inject body padding directly to simulate footer-expanded class
      document.body.style.paddingBottom = 'calc(80vh + 24px)';

      min?.classList.add('hidden');
      max?.classList.remove('hidden');
      min?.setAttribute('aria-expanded', 'true');
    } else {
      this.classList.remove('expanded');

      // Remove body padding
      document.body.style.paddingBottom = '';

      min?.classList.remove('hidden');
      max?.classList.add('hidden');
      min?.setAttribute('aria-expanded', 'false');
    }
  }

  openSettings() {
    // @ts-ignore
    const settings = this.shadowRoot.querySelector('#cookie-settings');
    // @ts-ignore
    const content = this.shadowRoot.querySelector('#footer-content');

    if (!settings) return;

    // Load current settings
    const consent = CookieManager.get('cookie_consent');
    // @ts-ignore
    const analyticsToggle = this.shadowRoot.querySelector('#analytics-toggle');
    // @ts-ignore
    const adsToggle = this.shadowRoot.querySelector('#ads-toggle');

    if (analyticsToggle) {
      // @ts-ignore
      analyticsToggle.checked = consent === 'accepted';
    }
    // @ts-ignore
    if (adsToggle) adsToggle.checked = false;

    // Force expand footer
    this.toggleFooter(true);

    settings.classList.remove('hidden');
    content?.classList.add('hidden');
  }

  closeSettings() {
    // @ts-ignore
    const settings = this.shadowRoot.querySelector('#cookie-settings');
    // @ts-ignore
    const content = this.shadowRoot.querySelector('#footer-content');

    settings?.classList.add('hidden');
    content?.classList.remove('hidden');

    // Reset footer to normal state
    this.toggleFooter(false);
  }

  bindEvents() {
    // Cookie trigger buttons
    // Use shadowRoot to add event listener? Or host?
    // Events bubble up from Shadow DOM (most of them).
    // But for specific elements like '.footer-min', we can listen on shadowRoot or the element itself.
    // 'click' bubbles.
    this.addEventListener('click', (e) => {
      // e.target is retargeted to host if outside, but if we listen ON host, we need composedPath() to find internal target
      // OR we listen on shadowRoot.
      const path = e.composedPath();
      // @ts-ignore
      const trigger = path.find(el => el.matches && el.matches('[data-cookie-trigger]'));
      if (trigger) {
        e.preventDefault();
        e.stopPropagation();
        this.openSettings();
      }
    });

    // Settings close button
    // @ts-ignore
    const closeBtn = this.shadowRoot.querySelector('#close-settings');
    closeBtn?.addEventListener('click', () => this.closeSettings());

    // Footer minimize click
    // @ts-ignore
    const footerMin = this.shadowRoot.querySelector('.footer-min');
    footerMin?.addEventListener('click', (e) => {
      // Ignore clicks on interactive elements
      // @ts-ignore
      if (e.target.closest('a, button, input, .cookie-inline')) {
        return;
      }
      this.toggleFooter();
    });

    // Newsletter form
    // @ts-ignore
    const form = this.shadowRoot.querySelector('.newsletter-form');
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
      // @ts-ignore
      form.reset();
      a11y?.announce('Newsletter abonniert', { priority: 'polite' });
    });

    // Cookie Settings Buttons
    this.bindSettingsButtons();
  }

  bindSettingsButtons() {
    // @ts-ignore
    const rejectAll = this.shadowRoot.querySelector('#reject-all');
    // @ts-ignore
    const acceptSelected = this.shadowRoot.querySelector('#accept-selected');
    // @ts-ignore
    const acceptAll = this.shadowRoot.querySelector('#accept-all');

    rejectAll?.addEventListener('click', () => {
      CookieManager.set('cookie_consent', 'rejected');
      CookieManager.deleteAnalytics();
      this.analytics.updateConsent(false);
      // @ts-ignore
      this.shadowRoot.querySelector('#cookie-banner')?.classList.add('hidden');
      a11y?.announce('Nur notwendige Cookies', { priority: 'polite' });
      this.closeSettings();
    });

    acceptSelected?.addEventListener('click', () => {
      // @ts-ignore
      const analyticsEnabled = /** @type {HTMLInputElement} */ (this.shadowRoot.querySelector('#analytics-toggle'))?.checked;
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

      // @ts-ignore
      this.shadowRoot.querySelector('#cookie-banner')?.classList.add('hidden');
      a11y?.announce('Einstellungen gespeichert', { priority: 'polite' });
      this.closeSettings();
    });

    acceptAll?.addEventListener('click', () => {
      CookieManager.set('cookie_consent', 'accepted');
      this.analytics.updateConsent(true);
      this.analytics.load();
      // @ts-ignore
      this.shadowRoot.querySelector('#cookie-banner')?.classList.add('hidden');
      a11y?.announce('Alle Cookies akzeptiert', { priority: 'polite' });
      this.closeSettings();
    });
  }
}

customElements.define('site-footer', SiteFooter);
