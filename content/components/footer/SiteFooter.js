// @ts-check
/**
 * Modern Site Footer Web Component
 * Scroll-based auto-expand/collapse footer with cookie management
 * @version 2.0.2
 */

import { createLogger } from '../../core/logger.js';
import { a11y } from '../../core/accessibility-manager.js';
import { i18n } from '../../core/i18n.js';
import { TimerManager } from '../../core/timer-utils.js';
import { EVENTS } from '../../core/events.js';

const log = createLogger('SiteFooter');

const CONFIG = {
  FOOTER_PATH: '/content/components/footer/footer',
  FOOTER_PATH_FALLBACK: '/content/components/footer/footer.html',
  TRANSITION_DURATION: 300,
  LOAD_RETRY_ATTEMPTS: 2,
  LOAD_RETRY_DELAY_MS: 500,
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
    this.timers = new TimerManager('SiteFooter');
    this.expanded = false;
    this.initialized = false;
    this.isTransitioning = false;
    this.touchStartY = 0;
    this.touchStartTime = 0;

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
    this._boundFooterTrigger = null;
    this._boundCookieTrigger = null;
  }

  async connectedCallback() {
    const src = this.getAttribute('src') || CONFIG.FOOTER_PATH;

    try {
      if (!this.innerHTML.trim()) {
        const html = await this._fetchFooterHTML(src);
        if (!this.isConnected) return;
        this.innerHTML = html;
      }

      this.init();
      this.setupLanguageUpdates();
      this.setupGlobalEventListeners();
      this.initialized = true;
      log.info('Footer initialized');
      this.dispatchEvent(
        new CustomEvent(EVENTS.FOOTER_LOADED, { bubbles: true }),
      );
    } catch (error) {
      log.error('Footer load failed', error);
    }
  }

  /**
   * Fetch footer HTML with retry logic and fallback path.
   * @param {string} primarySrc - Primary URL to fetch
   * @returns {Promise<string>} The footer HTML content
   */
  async _fetchFooterHTML(primarySrc) {
    const urls = [primarySrc];
    // Add .html fallback if primary doesn't end with .html
    if (!primarySrc.endsWith('.html')) {
      urls.push(primarySrc + '.html');
    } else if (primarySrc !== CONFIG.FOOTER_PATH) {
      urls.push(CONFIG.FOOTER_PATH);
    }

    for (const url of urls) {
      for (let attempt = 0; attempt <= CONFIG.LOAD_RETRY_ATTEMPTS; attempt++) {
        try {
          const response = await fetch(url, { redirect: 'follow' });
          if (response.ok) return await response.text();
          log.warn(
            `Footer fetch ${url} returned ${response.status} (attempt ${attempt + 1})`,
          );
        } catch (err) {
          log.warn(`Footer fetch ${url} failed (attempt ${attempt + 1})`, err);
        }
        if (attempt < CONFIG.LOAD_RETRY_ATTEMPTS) {
          await new Promise((r) =>
            setTimeout(r, CONFIG.LOAD_RETRY_DELAY_MS * (attempt + 1)),
          );
        }
      }
    }
    throw new Error(`Footer load failed — all URLs exhausted`);
  }

  disconnectedCallback() {
    this.cleanup();
  }

  cleanup() {
    this.removeGlobalEventListeners();
    this.timers.clearAll();

    if (typeof this._unsubscribeI18n === 'function') {
      this._unsubscribeI18n();
      this._unsubscribeI18n = null;
    }

    if (this._boundFooterTrigger) {
      document.removeEventListener('click', this._boundFooterTrigger);
      this._boundFooterTrigger = null;
    }

    if (this._boundCookieTrigger) {
      this.removeEventListener('click', this._boundCookieTrigger);
      this._boundCookieTrigger = null;
    }

    this._eventsbound = false;
    this._settingsEventsbound = false;

    // Observer aufräumen
    if (this.sectionObserver) {
      this.sectionObserver.disconnect();
      this.sectionObserver = null;
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
    // Initial translation
    this.updateLanguage(i18n.currentLang);
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
    this.timers.setTimeout(() => banner.classList.add('hidden'), 300);

    CookieManager.set('cookie_consent', 'accepted');
    this.analytics.updateConsent(true);
    this.analytics.load();
    a11y?.announce(i18n.t('footer.messages.accepted'), { priority: 'polite' });
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
    this.timers.setTimeout(() => banner.classList.add('hidden'), 300);

    CookieManager.set('cookie_consent', 'rejected');
    this.analytics.updateConsent(false);
    a11y?.announce(i18n.t('footer.messages.rejected'), { priority: 'polite' });
  }

  setupScrollHandler() {
    if (!this.elements.footer) return;

    // 1. Prüfen, ob wir auf der Startseite sind
    const path = window.location.pathname;
    const isHomePage = path === '/' || path === '/index.html';

    // AUF PAGES (Unterseiten): Kein automatisches Maximieren
    if (!isHomePage) {
      log.info('Auto-expand disabled on subpages. Footer needs manual click.');
      return;
    }

    // AUF STARTSEITE: Nur bei einer bestimmten Section auslösen
    // Sucht z.B. die letzte Section im Main-Bereich oder ein Element mit [data-auto-footer]
    const targetSection =
      document.querySelector('[data-auto-footer]') ||
      document.querySelector('main > section:last-of-type');

    if (!targetSection) {
      log.info('No target section found for footer auto-expand.');
      return;
    }

    // 2. Performanter IntersectionObserver statt Scroll-Events
    this.sectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (this.isTransitioning) return;

          if (entry.isIntersecting) {
            // Section ist im sichtbaren Bereich -> Maximieren
            if (!this.expanded) this.toggleFooter(true);
          } else {
            // Nutzer scrollt wieder hoch -> Minimieren
            if (this.expanded && entry.boundingClientRect.top > 0) {
              this.toggleFooter(false);
            }
          }
        });
      },
      {
        root: null,
        threshold: 0.1, // Löst aus, wenn die Section zu 10% sichtbar ist
        rootMargin: '0px 0px 50px 0px',
      },
    );

    this.sectionObserver.observe(targetSection);
    log.info(
      'IntersectionObserver for footer auto-expand initialized on section',
    );
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
    // Note: TimerManager creates a new ID each time, so we just set a new timeout
    // and rely on clearAll() or specific clearing if needed.
    // However, here we want debounce behavior, so we need to clear the previous one.
    // We didn't store resizeTimeout ID in 'this' in the original code properly
    // (it was this.resizeTimeout = null in constructor).
    // Let's use a property for it.

    if (this.resizeTimeout) this.timers.clearTimeout(this.resizeTimeout);

    this.resizeTimeout = this.timers.setTimeout(() => {
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
      // Status: Maximiert
      footer.classList.add('expanded');
      document.body.classList.add('footer-expanded');

      // Sichtbarkeiten toggeln
      footerMin?.classList.add('hidden');
      footerMax?.classList.remove('hidden');

      // Accessibility Updates
      footerMin?.setAttribute('aria-expanded', 'true');
      footerTriggers.forEach((t) => t.setAttribute('aria-expanded', 'true'));
      a11y?.announce(i18n.t('footer.actions.expanded'), { priority: 'polite' });
      this.dispatchEvent(
        new CustomEvent(EVENTS.FOOTER_EXPANDED, { bubbles: true }),
      );

      // Fokus-Management optimiert
      const firstFocusable = /** @type {HTMLElement|null} */ (
        footerMax?.querySelector(
          'button, a, input, [tabindex]:not([tabindex="-1"])',
        )
      );
      if (firstFocusable?.focus) {
        this.timers.setTimeout(() => firstFocusable.focus(), 150);
      }
    } else {
      // Status: Minimiert
      footer.classList.remove('expanded');
      document.body.classList.remove('footer-expanded');

      // Sichtbarkeiten toggeln
      footerMin?.classList.remove('hidden');
      footerMax?.classList.add('hidden');

      // Accessibility Updates
      footerMin?.setAttribute('aria-expanded', 'false');
      footerTriggers.forEach((t) => t.setAttribute('aria-expanded', 'false'));
      a11y?.announce(i18n.t('footer.actions.minimize'), { priority: 'polite' });
      this.dispatchEvent(
        new CustomEvent(EVENTS.FOOTER_COLLAPSED, { bubbles: true }),
      );
    }

    // Transition-Sperre aufheben
    this.timers.setTimeout(() => {
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
      this.timers.setTimeout(() => closeBtn.focus(), 100);
    }

    a11y?.announce(i18n.t('footer.messages.opened'), { priority: 'polite' });
  }

  closeSettings() {
    const { cookieSettings, footerContent } = this.elements;
    cookieSettings?.classList.add('hidden');
    footerContent?.classList.remove('hidden');
    a11y?.announce(i18n.t('footer.messages.closed'), { priority: 'polite' });
  }

  bindEvents() {
    const { closeBtn, footerMin } = this.elements;

    // Verhindere mehrfache Event-Registrierung
    if (this._eventsbound) return;
    this._eventsbound = true;

    // Footer-Trigger (außerhalb des Footers)
    this._boundFooterTrigger = (e) => {
      const target = /** @type {Element} */ (e.target);
      const trigger = target.closest('[data-footer-trigger]');
      if (trigger) {
        e.preventDefault();
        e.stopPropagation();
        this.toggleFooter(true);
        trigger.setAttribute('aria-expanded', 'true');
      }
    };
    document.addEventListener('click', this._boundFooterTrigger);

    // Cookie-Trigger
    this._boundCookieTrigger = (e) => {
      const target = /** @type {Element} */ (e.target);
      if (target.closest('[data-cookie-trigger]')) {
        e.preventDefault();
        e.stopPropagation();
        this.openSettings();
      }
    };
    this.addEventListener('click', this._boundCookieTrigger);

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
      a11y?.announce(i18n.t('footer.messages.necessary_only'), {
        priority: 'polite',
      });
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
      a11y?.announce(i18n.t('footer.messages.saved'), { priority: 'polite' });
      this.closeSettings();
    });

    acceptAll?.addEventListener('click', () => {
      CookieManager.set('cookie_consent', 'accepted');
      this.analytics.updateConsent(true);
      this.analytics.load();
      cookieBanner?.classList.add('hidden');
      a11y?.announce(i18n.t('footer.messages.all_accepted'), {
        priority: 'polite',
      });
      this.closeSettings();
    });
  }

  setupLanguageUpdates() {
    this._unsubscribeI18n = i18n.subscribe((_lang) => {
      this.updateLanguage(_lang);
    });
  }

  updateLanguage(_lang) {
    i18n.translateElement(this);
  }
}

customElements.define('site-footer', SiteFooter);
