// @ts-check

/**

 * Modern Site Footer Web Component v3.0.0

 * Optimized architecture with complete memory leak prevention

 * @version 3.0.0

 */

import { createLogger } from '../../core/logger.js';

import { a11y } from '../../core/accessibility-manager.js';

import { i18n } from '../../core/i18n.js';

import { TimerManager } from '../../core/utils.js';

import { EVENTS } from '../../core/events.js';

const log = createLogger('SiteFooter');

/** @typedef {import('/content/core/types.js').FooterElements} FooterElements */

const CONFIG = Object.freeze({
  FOOTER_PATH: '/content/components/footer/footer',

  FOOTER_PATH_FALLBACK: '/content/components/footer/footer.html',

  TRANSITION_DURATION: 300,

  LOAD_RETRY_ATTEMPTS: 2,

  LOAD_RETRY_DELAY_MS: 500,
});

/**

 * Cookie Management Utility

 */

const CookieManager = Object.freeze({
  /**

   * @param {string} name

   * @param {string} value

   * @param {number} [days=365]

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
});

/**

 * Analytics Manager

 */

class AnalyticsManager {
  #loaded = false;

  load() {
    if (this.#loaded) return;

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

    this.#loaded = true;

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
  // Private fields

  #analytics = new AnalyticsManager();

  #timers = new TimerManager('SiteFooter');

  #listeners = new Map();

  #state = {
    expanded: false,

    initialized: false,

    isTransitioning: false,

    touchStartY: 0,

    touchStartTime: 0,

    baseFooterHeight: 76,
  };

  /** @type {FooterElements} */

  #elements = {
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

  constructor() {
    super();
  }

  async connectedCallback() {
    const src = this.getAttribute('src') || CONFIG.FOOTER_PATH;

    try {
      if (!this.innerHTML.trim()) {
        const html = await this.#fetchFooterHTML(src);

        if (!this.isConnected) return;

        this.innerHTML = html;
      }

      this.#init();

      this.#setupLanguageUpdates();

      this.#setupGlobalEventListeners();

      this.#state.initialized = true;

      log.info('Footer initialized');

      this.dispatchEvent(
        new CustomEvent(EVENTS.FOOTER_LOADED, { bubbles: true }),
      );
    } catch (error) {
      log.error('Footer load failed', error);
    }
  }

  disconnectedCallback() {
    this.#cleanup();
  }

  /**

   * Fetch footer HTML with retry logic

   * @param {string} primarySrc

   * @returns {Promise<string>}

   */

  async #fetchFooterHTML(primarySrc) {
    const urls = [primarySrc];

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

    throw new Error('Footer load failed — all URLs exhausted');
  }

  /**

   * Complete cleanup of all event listeners and resources

   */

  #cleanup() {
    const unsubscribe = this.#listeners.get('i18n:unsubscribe');

    // Remove all stored event listeners

    this.#listeners.forEach((listener, key) => {
      if (key === 'i18n:unsubscribe') return;

      const [element, event] = key.split(':');

      const el =
        element === 'document'
          ? document
          : element === 'window'
            ? window
            : element === 'this'
              ? this
              : this.#elements[/** @type {keyof FooterElements} */ (element)];

      if (el) {
        el.removeEventListener(event, listener);
      }
    });

    this.#listeners.clear();

    // Clear all timers

    this.#timers.clearAll();

    // Unsubscribe from i18n

    if (typeof unsubscribe === 'function') {
      unsubscribe();
    }

    // Reset state

    this.#state.initialized = false;

    log.info('Footer cleanup complete');
  }

  /**

   * Add event listener with automatic tracking for cleanup

   * @param {string} key - Unique identifier (e.g., 'acceptBtn:click')

   * @param {EventTarget} element

   * @param {string} event

   * @param {EventListener} handler

   * @param {AddEventListenerOptions} [options]

   */

  #addListener(key, element, event, handler, options) {
    if (this.#listeners.has(key)) {
      log.warn(`Listener ${key} already registered`);

      return;
    }

    element.addEventListener(event, handler, options);

    this.#listeners.set(key, handler);
  }

  #init() {
    this.#cacheElements();

    this.#setupDate();

    this.#setupCookieBanner();

    this.#bindEvents();

    this.#updateLanguage(i18n.currentLang);
  }

  #cacheElements() {
    this.#elements = {
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

    try {
      const root = document.documentElement;

      const raw = getComputedStyle(root).getPropertyValue('--footer-height');

      this.#state.baseFooterHeight = parseFloat(raw) || 76;
    } catch {
      this.#state.baseFooterHeight = 76;
    }
  }

  #setupDate() {
    const year = new Date().getFullYear();

    this.querySelectorAll('.year').forEach(
      (el) => (el.textContent = String(year)),
    );
  }

  #setupCookieBanner() {
    const { cookieBanner, acceptBtn, rejectBtn } = this.#elements;

    if (!cookieBanner || !acceptBtn || !rejectBtn) return;

    const consent = CookieManager.get('cookie_consent');

    const shouldShow = consent !== 'accepted' && consent !== 'rejected';

    cookieBanner.classList.toggle('hidden', !shouldShow);

    // Adjust footer height for cookie banner

    this.#updateFooterHeight(shouldShow);

    // Load analytics if already accepted

    if (consent === 'accepted') {
      this.#analytics.updateConsent(true);

      this.#analytics.load();
    } else if (consent === 'rejected') {
      this.#analytics.updateConsent(false);
    }

    // Bind cookie banner buttons

    this.#addListener('acceptBtn:click', acceptBtn, 'click', (e) => {
      e.stopPropagation();

      this.#acceptCookies();
    });

    this.#addListener('rejectBtn:click', rejectBtn, 'click', (e) => {
      e.stopPropagation();

      this.#rejectCookies();
    });
  }

  /**

   * @param {boolean} showBanner

   */

  #updateFooterHeight(showBanner) {
    try {
      const root = document.documentElement;

      const { cookieBanner } = this.#elements;

      if (showBanner && cookieBanner) {
        const bannerHeight = Math.round(
          cookieBanner.getBoundingClientRect().height || 0,
        );

        root.style.setProperty(
          '--footer-height',

          `${this.#state.baseFooterHeight + bannerHeight}px`,
        );

        root.classList.add('footer-cookie-visible');
      } else {
        root.style.setProperty(
          '--footer-height',

          `${this.#state.baseFooterHeight}px`,
        );

        root.classList.remove('footer-cookie-visible');
      }
    } catch {
      /* noop */
    }
  }

  #acceptCookies() {
    const { cookieBanner } = this.#elements;

    if (!cookieBanner) return;

    const styledBanner =
      /** @type {import('/content/core/types.js').StyledHTMLElement} */ (
        cookieBanner
      );

    styledBanner.style.animation = 'cookieSlideOut 0.3s ease-out forwards';

    this.#timers.setTimeout(() => {
      cookieBanner.classList.add('hidden');

      this.#updateFooterHeight(false);
    }, 300);

    CookieManager.set('cookie_consent', 'accepted');

    this.#analytics.updateConsent(true);

    this.#analytics.load();

    a11y?.announce(i18n.t('footer.messages.accepted'), { priority: 'polite' });
  }

  #rejectCookies() {
    const { cookieBanner } = this.#elements;

    if (!cookieBanner) return;

    const styledBanner =
      /** @type {import('/content/core/types.js').StyledHTMLElement} */ (
        cookieBanner
      );

    styledBanner.style.animation = 'cookieSlideOut 0.3s ease-out forwards';

    this.#timers.setTimeout(() => {
      cookieBanner.classList.add('hidden');

      this.#updateFooterHeight(false);
    }, 300);

    CookieManager.set('cookie_consent', 'rejected');

    this.#analytics.updateConsent(false);

    a11y?.announce(i18n.t('footer.messages.rejected'), { priority: 'polite' });
  }

  #setupGlobalEventListeners() {
    /** @type {EventListener} */

    const handleOutsideClick = (e) => {
      if (!this.#state.expanded || this.#state.isTransitioning) return;

      const target = /** @type {Element} */ (e.target);

      if (!target.closest('site-footer')) {
        this.#toggleFooter(false);
      }
    };

    /** @type {EventListener} */

    const handleKeyDown = (e) => {
      const keyEvent = /** @type {KeyboardEvent} */ (e);

      if (!this.#state.expanded || keyEvent.key !== 'Escape') return;

      keyEvent.preventDefault();

      this.#toggleFooter(false);

      const trigger = /** @type {HTMLElement|null} */ (
        document.querySelector('[data-footer-trigger]')
      );

      trigger?.focus();
    };

    /** @type {EventListener} */

    const handleTouchStart = (e) => {
      const touchEvent = /** @type {TouchEvent} */ (e);

      if (
        !this.#elements.footerMin?.contains(
          /** @type {Node} */ (touchEvent.target),
        )
      )
        return;

      this.#state.touchStartY = touchEvent.touches[0].clientY;

      this.#state.touchStartTime = Date.now();
    };

    /** @type {EventListener} */

    const handleTouchEnd = (e) => {
      const touchEvent = /** @type {TouchEvent} */ (e);

      if (
        !this.#elements.footerMin?.contains(
          /** @type {Node} */ (touchEvent.target),
        ) ||
        this.#state.isTransitioning
      )
        return;

      const touchEndY = touchEvent.changedTouches[0].clientY;

      const touchDuration = Date.now() - this.#state.touchStartTime;

      const touchDistance = Math.abs(touchEndY - this.#state.touchStartY);

      if (
        touchDuration < 300 &&
        (touchDistance < 10 || this.#state.touchStartY - touchEndY > 30)
      ) {
        touchEvent.preventDefault();

        this.#toggleFooter(true);
      }
    };

    /** @type {EventListener} */

    const handleResize = () => {
      const timeoutId = this.#timers.setTimeout(() => {
        if (this.#state.expanded) this.#updateFooterPosition();
      }, 150);

      this.#listeners.set('resize:timeout', timeoutId);
    };

    this.#addListener('document:click', document, 'click', handleOutsideClick, {
      passive: false,
    });

    this.#addListener('document:keydown', document, 'keydown', handleKeyDown, {
      passive: false,
    });

    this.#addListener(
      'document:touchstart',

      document,

      'touchstart',

      handleTouchStart,

      { passive: true },
    );

    this.#addListener(
      'document:touchend',

      document,

      'touchend',

      handleTouchEnd,

      { passive: false },
    );

    this.#addListener('window:resize', window, 'resize', handleResize, {
      passive: true,
    });
  }

  #updateFooterPosition() {
    const { footer } = this.#elements;

    if (!footer) return;

    const rect = footer.getBoundingClientRect();

    if (rect.bottom > window.innerHeight) {
      footer.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }

  /**

   * @param {boolean} [forceState]

   */

  #toggleFooter(forceState) {
    const { footer, footerMin, footerMax } = this.#elements;

    if (!footer || this.#state.isTransitioning) return;

    const newState =
      forceState !== undefined ? forceState : !this.#state.expanded;

    if (newState === this.#state.expanded) return;

    this.#state.isTransitioning = true;

    this.#state.expanded = newState;

    const footerTriggers = document.querySelectorAll('[data-footer-trigger]');

    if (this.#state.expanded) {
      footer.classList.add('expanded');

      document.body.classList.add('footer-expanded');

      footerMin?.classList.add('hidden');

      footerMax?.classList.remove('hidden');

      footerMin?.setAttribute('aria-expanded', 'true');

      footerTriggers.forEach((t) => t.setAttribute('aria-expanded', 'true'));

      a11y?.announce(i18n.t('footer.actions.expanded'), { priority: 'polite' });

      this.dispatchEvent(
        new CustomEvent(EVENTS.FOOTER_EXPANDED, { bubbles: true }),
      );

      const firstFocusable = /** @type {HTMLElement|null} */ (
        footerMax?.querySelector(
          'button, a, input, [tabindex]:not([tabindex="-1"])',
        )
      );

      if (firstFocusable) {
        this.#timers.setTimeout(() => firstFocusable.focus(), 100);
      }
    } else {
      footer.classList.remove('expanded');

      document.body.classList.remove('footer-expanded');

      footerMin?.classList.remove('hidden');

      footerMax?.classList.add('hidden');

      footerMin?.setAttribute('aria-expanded', 'false');

      footerTriggers.forEach((t) => t.setAttribute('aria-expanded', 'false'));

      a11y?.announce(i18n.t('footer.actions.minimized'), {
        priority: 'polite',
      });

      this.dispatchEvent(
        new CustomEvent(EVENTS.FOOTER_COLLAPSED, { bubbles: true }),
      );
    }

    this.#timers.setTimeout(() => {
      this.#state.isTransitioning = false;
    }, CONFIG.TRANSITION_DURATION);
  }

  #openSettings() {
    const { cookieSettings, footerContent, analyticsToggle, adsToggle } =
      this.#elements;

    if (!cookieSettings) return;

    const consent = CookieManager.get('cookie_consent');

    if (analyticsToggle) {
      /** @type {HTMLInputElement} */ (analyticsToggle).checked =
        consent === 'accepted';
    }

    if (adsToggle) {
      /** @type {HTMLInputElement} */ (adsToggle).checked = false;
    }

    if (!this.#state.expanded) this.#toggleFooter(true);

    cookieSettings.classList.remove('hidden');

    footerContent?.classList.add('hidden');

    const closeBtn = /** @type {HTMLElement|null} */ (
      cookieSettings.querySelector('#close-settings')
    );

    if (closeBtn) {
      this.#timers.setTimeout(() => closeBtn.focus(), 100);
    }

    a11y?.announce(i18n.t('footer.messages.opened'), { priority: 'polite' });
  }

  #closeSettings() {
    const { cookieSettings, footerContent } = this.#elements;

    cookieSettings?.classList.add('hidden');

    footerContent?.classList.remove('hidden');

    a11y?.announce(i18n.t('footer.messages.closed'), { priority: 'polite' });
  }

  #bindEvents() {
    const { closeBtn, footerMin } = this.#elements;

    // Footer-Trigger (außerhalb des Footers)

    /** @type {EventListener} */

    const footerTriggerHandler = (e) => {
      const target = /** @type {Element} */ (e.target);

      const trigger = target.closest('[data-footer-trigger]');

      if (trigger) {
        e.preventDefault();

        e.stopPropagation();

        this.#toggleFooter(true);

        trigger.setAttribute('aria-expanded', 'true');
      }
    };

    this.#addListener(
      'document:footerTrigger',

      document,

      'click',

      footerTriggerHandler,
    );

    // Cookie-Trigger

    /** @type {EventListener} */

    const cookieTriggerHandler = (e) => {
      const target = /** @type {Element} */ (e.target);

      if (target.closest('[data-cookie-trigger]')) {
        e.preventDefault();

        e.stopPropagation();

        this.#openSettings();
      }
    };

    this.#addListener(
      'this:cookieTrigger',

      this,

      'click',

      cookieTriggerHandler,
    );

    // Settings schließen

    if (closeBtn) {
      this.#addListener('closeBtn:click', closeBtn, 'click', () =>
        this.#closeSettings(),
      );
    }

    // Footer minimiert - Klick zum Erweitern

    if (footerMin) {
      /** @type {EventListener} */

      const footerMinClickHandler = (e) => {
        const target = /** @type {Element} */ (e.target);

        if (target.closest('a, button, input, .cookie-inline')) return;

        if (this.#state.isTransitioning) {
          e.preventDefault();

          return;
        }

        this.#toggleFooter();
      };

      this.#addListener(
        'footerMin:click',

        footerMin,

        'click',

        footerMinClickHandler,
      );

      // Keyboard Support

      /** @type {EventListener} */

      const footerMinKeydownHandler = (e) => {
        const keyEvent = /** @type {KeyboardEvent} */ (e);

        if (keyEvent.key === 'Enter' || keyEvent.key === ' ') {
          const target = /** @type {Element} */ (keyEvent.target);

          if (!target.closest('a, button, input, .cookie-inline')) {
            keyEvent.preventDefault();

            this.#toggleFooter();
          }
        }
      };

      this.#addListener(
        'footerMin:keydown',

        footerMin,

        'keydown',

        footerMinKeydownHandler,
      );
    }

    this.#bindSettingsButtons();
  }

  #bindSettingsButtons() {
    const {
      rejectAll,

      acceptSelected,

      acceptAll,

      analyticsToggle,

      cookieBanner,
    } = this.#elements;

    if (rejectAll) {
      /** @type {EventListener} */

      const rejectAllHandler = () => {
        CookieManager.set('cookie_consent', 'rejected');

        CookieManager.deleteAnalytics();

        this.#analytics.updateConsent(false);

        cookieBanner?.classList.add('hidden');

        a11y?.announce(i18n.t('footer.messages.necessary_only'), {
          priority: 'polite',
        });

        this.#closeSettings();
      };

      this.#addListener(
        'rejectAll:click',

        rejectAll,

        'click',

        rejectAllHandler,
      );
    }

    if (acceptSelected) {
      /** @type {EventListener} */

      const acceptSelectedHandler = () => {
        const toggle = /** @type {HTMLInputElement|null} */ (analyticsToggle);

        const analyticsEnabled = toggle?.checked ?? false;

        CookieManager.set(
          'cookie_consent',

          analyticsEnabled ? 'accepted' : 'rejected',
        );

        if (analyticsEnabled) {
          this.#analytics.updateConsent(true);

          this.#analytics.load();
        } else {
          this.#analytics.updateConsent(false);

          CookieManager.deleteAnalytics();
        }

        cookieBanner?.classList.add('hidden');

        a11y?.announce(i18n.t('footer.messages.saved'), { priority: 'polite' });

        this.#closeSettings();
      };

      this.#addListener(
        'acceptSelected:click',

        acceptSelected,

        'click',

        acceptSelectedHandler,
      );
    }

    if (acceptAll) {
      /** @type {EventListener} */

      const acceptAllHandler = () => {
        CookieManager.set('cookie_consent', 'accepted');

        this.#analytics.updateConsent(true);

        this.#analytics.load();

        cookieBanner?.classList.add('hidden');

        a11y?.announce(i18n.t('footer.messages.all_accepted'), {
          priority: 'polite',
        });

        this.#closeSettings();
      };

      this.#addListener(
        'acceptAll:click',

        acceptAll,

        'click',

        acceptAllHandler,
      );
    }
  }

  #setupLanguageUpdates() {
    /** @type {(lang: string) => void} */

    const languageChangeHandler = (lang) => {
      this.#updateLanguage(lang);
    };

    const unsubscribe = i18n.subscribe(languageChangeHandler);

    this.#listeners.set('i18n:unsubscribe', unsubscribe);
  }

  /**

   * @param {string} _lang

   */

  #updateLanguage(_lang) {
    i18n.translateElement(this);
  }
}

// Register Custom Element

customElements.define('site-footer', SiteFooter);
