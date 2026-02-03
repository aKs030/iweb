// @ts-check
/**
 * Modern Site Footer Web Component
 * Scroll-based auto-expand/collapse footer with cookie management
 * @version 2.0.1
 */

import { createLogger } from '/content/core/logger.js';
import { a11y } from '/content/core/accessibility-manager.js';
import { i18n } from '/content/core/i18n.js';

const log = createLogger('SiteFooter');

const CONFIG = {
  FOOTER_PATH: '/content/components/footer/footer.html',
  SCROLL_DEBOUNCE_MS: 100,
  EXPAND_THRESHOLD: 100,
  COLLAPSE_THRESHOLD: 300,
  TRANSITION_DURATION: 300,
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
    this.expanded = false;
    this.initialized = false;
    this.isTransitioning = false;
    this.lastScrollY = 0;
    this.touchStartY = 0;
    this.touchStartTime = 0;
    this.resizeTimeout = null;
    this.scrollTimeout = null;
    this.scrollHandler = null;

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
    };

    this.handleOutsideClick = this.handleOutsideClick.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleTouchStart = this.handleTouchStart.bind(this);
    this.handleTouchEnd = this.handleTouchEnd.bind(this);
    this.handleResize = this.handleResize.bind(this);
  }

  async connectedCallback() {
    const src = this.getAttribute('src') || CONFIG.FOOTER_PATH;

    try {
      if (!this.innerHTML.trim()) {
        const response = await fetch(src);
        if (!response.ok) throw new Error('Footer load failed');
        this.innerHTML = await response.text();
      }

      this.init();
      this.setupLanguageUpdates();
      this.setupGlobalEventListeners();
      this.initialized = true;
      log.info('Footer initialized');
      this.dispatchEvent(new CustomEvent('footer:loaded', { bubbles: true }));
    } catch (error) {
      log.error('Footer load failed', error);
    }
  }

  disconnectedCallback() {
    this.cleanup();
  }

  cleanup() {
    this.removeGlobalEventListeners();

    if (this.scrollHandler) {
      window.removeEventListener('scroll', this.scrollHandler);
      this.scrollHandler = null;
    }

    if (this.resizeTimeout) {
      clearTimeout(this.resizeTimeout);
      this.resizeTimeout = null;
    }

    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout);
      this.scrollTimeout = null;
    }
  }

  init() {
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
    };

    this.setupDate();
    this.setupCookieBanner();
    this.setupScrollHandler();
    this.bindEvents();
  }

  setupDate() {
    const year = new Date().getFullYear();
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
    if (!this.elements.footer) return;

    // Prüfe ob Seite überhaupt scrollbar ist
    const isScrollable =
      document.documentElement.scrollHeight > window.innerHeight;
    if (!isScrollable) {
      log.info('Page not scrollable - scroll handler disabled');
      return;
    }

    this.lastScrollY = window.scrollY;

    this.scrollHandler = () => {
      if (this.scrollTimeout) clearTimeout(this.scrollTimeout);
      this.scrollTimeout = setTimeout(
        () => this.checkScrollPosition(),
        CONFIG.SCROLL_DEBOUNCE_MS,
      );
    };

    window.addEventListener('scroll', this.scrollHandler, { passive: true });

    // NICHT beim initialen Laden prüfen - nur bei tatsächlichem Scroll
    log.info('Scroll handler initialized');
  }

  checkScrollPosition() {
    if (this.isTransitioning) return;

    const scrollY = window.scrollY;
    const windowHeight = window.innerHeight;
    const documentHeight = document.documentElement.scrollHeight;
    const scrollBottom = scrollY + windowHeight;
    const distanceFromBottom = documentHeight - scrollBottom;
    const scrollDirection = scrollY > this.lastScrollY ? 'down' : 'up';

    if (distanceFromBottom < CONFIG.EXPAND_THRESHOLD && !this.expanded) {
      this.toggleFooter(true);
    } else if (
      scrollDirection === 'up' &&
      distanceFromBottom > CONFIG.COLLAPSE_THRESHOLD &&
      this.expanded
    ) {
      this.toggleFooter(false);
    }

    this.lastScrollY = scrollY;
  }

  setupGlobalEventListeners() {
    document.addEventListener('click', this.handleOutsideClick, {
      passive: false,
    });
    document.addEventListener('keydown', this.handleKeyDown, {
      passive: false,
    });
    document.addEventListener('touchstart', this.handleTouchStart, {
      passive: true,
    });
    document.addEventListener('touchend', this.handleTouchEnd, {
      passive: false,
    });
    window.addEventListener('resize', this.handleResize, { passive: true });
  }

  removeGlobalEventListeners() {
    document.removeEventListener('click', this.handleOutsideClick);
    document.removeEventListener('keydown', this.handleKeyDown);
    document.removeEventListener('touchstart', this.handleTouchStart);
    document.removeEventListener('touchend', this.handleTouchEnd);
    window.removeEventListener('resize', this.handleResize);
  }

  handleOutsideClick(e) {
    if (!this.expanded || this.isTransitioning) return;

    const target = /** @type {Element} */ (e.target);
    const clickedInFooter = target.closest('site-footer');

    if (!clickedInFooter) {
      this.toggleFooter(false);
    }
  }

  handleKeyDown(e) {
    if (!this.expanded || e.key !== 'Escape') return;

    e.preventDefault();
    this.toggleFooter(false);

    const trigger = /** @type {HTMLElement|null} */ (
      document.querySelector('[data-footer-trigger]')
    );
    if (trigger?.focus) trigger.focus();
  }

  handleTouchStart(e) {
    if (!this.elements.footerMin?.contains(e.target)) return;

    this.touchStartY = e.touches[0].clientY;
    this.touchStartTime = Date.now();
  }

  handleTouchEnd(e) {
    if (!this.elements.footerMin?.contains(e.target) || this.isTransitioning)
      return;

    const touchEndY = e.changedTouches[0].clientY;
    const touchDuration = Date.now() - this.touchStartTime;
    const touchDistance = Math.abs(touchEndY - this.touchStartY);

    if (
      touchDuration < 300 &&
      (touchDistance < 10 || this.touchStartY - touchEndY > 30)
    ) {
      e.preventDefault();
      this.toggleFooter(true);
    }
  }

  handleResize() {
    if (this.resizeTimeout) clearTimeout(this.resizeTimeout);

    this.resizeTimeout = setTimeout(() => {
      if (this.expanded) this.updateFooterPosition();
    }, 150);
  }

  updateFooterPosition() {
    const { footer } = this.elements;
    if (!footer) return;

    const rect = footer.getBoundingClientRect();
    if (rect.bottom > window.innerHeight) {
      footer.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }

  toggleFooter(forceState) {
    const { footer, footerMin, footerMax } = this.elements;
    if (!footer || this.isTransitioning) return;

    const newState = forceState !== undefined ? forceState : !this.expanded;
    if (newState === this.expanded) return;

    this.isTransitioning = true;
    this.expanded = newState;

    const footerTriggers = document.querySelectorAll('[data-footer-trigger]');

    if (this.expanded) {
      footer.classList.add('expanded');
      document.body.classList.add('footer-expanded');
      footerMin?.classList.add('hidden');
      footerMax?.classList.remove('hidden');
      footerMin?.setAttribute('aria-expanded', 'true');
      footerTriggers.forEach((t) => t.setAttribute('aria-expanded', 'true'));
      a11y?.announce('Footer erweitert', { priority: 'polite' });

      const firstFocusable = /** @type {HTMLElement|null} */ (
        footerMax?.querySelector(
          'button, a, input, [tabindex]:not([tabindex="-1"])',
        )
      );
      if (firstFocusable?.focus) {
        setTimeout(() => firstFocusable.focus(), 100);
      }
    } else {
      footer.classList.remove('expanded');
      document.body.classList.remove('footer-expanded');
      footerMin?.classList.remove('hidden');
      footerMax?.classList.add('hidden');
      footerMin?.setAttribute('aria-expanded', 'false');
      footerTriggers.forEach((t) => t.setAttribute('aria-expanded', 'false'));
      a11y?.announce('Footer minimiert', { priority: 'polite' });
    }

    setTimeout(() => {
      this.isTransitioning = false;
    }, CONFIG.TRANSITION_DURATION);
  }

  openSettings() {
    const { cookieSettings, footerContent, analyticsToggle, adsToggle } =
      this.elements;
    if (!cookieSettings) return;

    const consent = CookieManager.get('cookie_consent');

    if (analyticsToggle) {
      /** @type {HTMLInputElement} */ (analyticsToggle).checked =
        consent === 'accepted';
    }
    if (adsToggle) {
      /** @type {HTMLInputElement} */ (adsToggle).checked = false;
    }

    if (!this.expanded) this.toggleFooter(true);

    cookieSettings.classList.remove('hidden');
    footerContent?.classList.add('hidden');

    const closeBtn = /** @type {HTMLElement|null} */ (
      cookieSettings.querySelector('#close-settings')
    );
    if (closeBtn?.focus) {
      setTimeout(() => closeBtn.focus(), 100);
    }

    a11y?.announce('Cookie-Einstellungen geöffnet', { priority: 'polite' });
  }

  closeSettings() {
    const { cookieSettings, footerContent } = this.elements;
    cookieSettings?.classList.add('hidden');
    footerContent?.classList.remove('hidden');
    a11y?.announce('Cookie-Einstellungen geschlossen', { priority: 'polite' });
  }

  bindEvents() {
    const { closeBtn, footerMin } = this.elements;

    // Verhindere mehrfache Event-Registrierung
    if (this._eventsbound) return;
    this._eventsbound = true;

    // Footer-Trigger (außerhalb des Footers)
    const handleFooterTrigger = (e) => {
      const target = /** @type {Element} */ (e.target);
      const trigger = target.closest('[data-footer-trigger]');
      if (trigger) {
        e.preventDefault();
        e.stopPropagation();
        this.toggleFooter(true);
        trigger.setAttribute('aria-expanded', 'true');
      }
    };
    document.addEventListener('click', handleFooterTrigger);

    // Cookie-Trigger
    const handleCookieTrigger = (e) => {
      const target = /** @type {Element} */ (e.target);
      if (target.closest('[data-cookie-trigger]')) {
        e.preventDefault();
        e.stopPropagation();
        this.openSettings();
      }
    };
    this.addEventListener('click', handleCookieTrigger);

    // Settings schließen
    closeBtn?.addEventListener('click', () => this.closeSettings());

    // Footer minimiert - Klick zum Erweitern
    footerMin?.addEventListener('click', (e) => {
      const target = /** @type {Element} */ (e.target);
      if (target.closest('a, button, input, .cookie-inline')) return;
      if (this.isTransitioning) {
        e.preventDefault();
        return;
      }
      this.toggleFooter();
    });

    // Keyboard Support
    footerMin?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        const target = /** @type {Element} */ (e.target);
        if (!target.closest('a, button, input, .cookie-inline')) {
          e.preventDefault();
          this.toggleFooter();
        }
      }
    });

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

    // Verhindere mehrfache Event-Registrierung
    if (this._settingsEventsbound) return;
    this._settingsEventsbound = true;

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

  setupLanguageUpdates() {
    i18n.subscribe((_lang) => {
      this.updateLanguage(_lang);
    });
  }

  updateLanguage(_lang) {
    const elements = this.querySelectorAll('[data-i18n]');
    elements.forEach((el) => {
      const key = el.getAttribute('data-i18n');
      if (key) {
        el.textContent = i18n.t(key);
      }
    });
  }
}

customElements.define('site-footer', SiteFooter);
