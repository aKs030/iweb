// @ts-check

/**

 * Modern Site Footer Web Component v3.1.0

 * Optimized architecture with complete memory leak prevention

 * legacy/fallback logic removed 2026‑02‑26
 * @version 3.1.0

 */

import { createLogger } from '../../core/logger.js';
import { a11y } from '../../core/accessibility-manager.js';
import { i18n } from '../../core/i18n.js';
import { TimerManager } from '../../core/utils.js';
import { EVENTS } from '../../core/events.js';
import { CookieManager } from '../../core/cookie-manager.js';
import { AnalyticsManager } from '../../core/analytics-manager.js';

const log = createLogger('SiteFooter');

/** @typedef {import('/content/core/types.js').FooterElements} FooterElements */

const CONFIG = Object.freeze({
  // primary path used by <site-footer> instances; always serves HTML
  FOOTER_PATH: '/content/components/footer/footer.html',

  TRANSITION_DURATION: 300,

  LOAD_RETRY_ATTEMPTS: 2,

  LOAD_RETRY_DELAY_MS: 500,
});

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
   *
   * @param {string} src - URL or path to footer HTML (extension optional)
   * @returns {Promise<string>}
   */

  async #fetchFooterHTML(src) {
    // Simplified: always fetch HTML file (src may omit .html extension)
    const url = src.endsWith('.html') ? src : `${src}.html`;

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

    throw new Error('Footer load failed — all attempts exhausted');
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

    i18n.translateElement(this);
  }

  #cacheElements() {
    this.#elements = {
      // the `<footer>` element inside the custom element; no ID required
      footer: this.querySelector('footer.site-footer'),

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

    // base footer height no longer needs to be tracked in state;
    // we just add a fixed constant when updating the CSS variable.
    // legacy code has been removed.
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

      this.#handleConsent('accepted');
    });

    this.#addListener('rejectBtn:click', rejectBtn, 'click', (e) => {
      e.stopPropagation();

      this.#handleConsent('rejected');
    });
  }

  /**

   * @param {boolean} showBanner

   */

  #updateFooterHeight(showBanner) {
    try {
      const root = document.documentElement;
      const { cookieBanner } = this.#elements;

      const bannerHeight =
        showBanner && cookieBanner
          ? Math.round(cookieBanner.getBoundingClientRect().height || 0)
          : 0;

      // we no longer store a base height in state; the constant 76px is the
      // height of the collapsed footer and matches the CSS default.
      root.style.setProperty('--footer-height', `${76 + bannerHeight}px`);

      root.classList.toggle('footer-cookie-visible', !!showBanner);
    } catch {
      /* noop */
    }
  }

  /**
   * @param {'accepted' | 'rejected'} type
   */
  #handleConsent(type) {
    const { cookieBanner } = this.#elements;

    if (!cookieBanner) return;

    const isAccepted = type === 'accepted';
    const styledBanner =
      /** @type {import('/content/core/types.js').StyledHTMLElement} */ (
        cookieBanner
      );

    styledBanner.style.animation = 'cookieSlideOut 0.3s ease-out forwards';

    this.#timers.setTimeout(() => {
      cookieBanner.classList.add('hidden');
      this.#updateFooterHeight(false);
    }, 300);

    CookieManager.set('cookie_consent', type);
    this.#analytics.updateConsent(isAccepted);

    if (isAccepted) {
      this.#analytics.load();
    }

    a11y?.announce(i18n.t(`footer.messages.${type}`), { priority: 'polite' });
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
      this.#state.touchStartY = touchEvent.touches[0].clientY;
      this.#state.touchStartTime = Date.now();
    };

    /** @type {EventListener} */
    const handleTouchEnd = (e) => {
      if (this.#state.isTransitioning) return;
      const touchEvent = /** @type {TouchEvent} */ (e);
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

    // legacy resize handler removed – footer position no longer needs to
    // be recalculated on viewport change.  All callers of this method can
    // simply rely on the CSS layout.

    this.#addListener('document:click', document, 'click', handleOutsideClick, {
      passive: false,
    });

    this.#addListener('document:keydown', document, 'keydown', handleKeyDown, {
      passive: false,
    });

    if (this.#elements.footerMin) {
      this.#addListener(
        'footerMin:touchstart',
        this.#elements.footerMin,
        'touchstart',
        handleTouchStart,
        { passive: true },
      );

      this.#addListener(
        'footerMin:touchend',
        this.#elements.footerMin,
        'touchend',
        handleTouchEnd,
        { passive: false },
      );
    }

    // resize handling removed – no need to reposition footer on viewport changes
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

    footer.classList.toggle('expanded', newState);
    document.body.classList.toggle('footer-expanded', newState);

    footerMin?.classList.toggle('hidden', newState);
    footerMax?.classList.toggle('hidden', !newState);

    const ariaState = String(newState);
    footerMin?.setAttribute('aria-expanded', ariaState);
    footerTriggers.forEach((t) => t.setAttribute('aria-expanded', ariaState));

    const actionKey = newState ? 'expanded' : 'minimized';
    a11y?.announce(i18n.t(`footer.actions.${actionKey}`), {
      priority: 'polite',
    });

    this.dispatchEvent(
      new CustomEvent(
        newState ? EVENTS.FOOTER_EXPANDED : EVENTS.FOOTER_COLLAPSED,
        { bubbles: true },
      ),
    );

    if (newState) {
      const firstFocusable = /** @type {HTMLElement|null} */ (
        footerMax?.querySelector(
          'button, a, input, [tabindex]:not([tabindex="-1"])',
        )
      );

      if (firstFocusable) {
        this.#timers.setTimeout(() => firstFocusable.focus(), 100);
      }
    }

    this.#timers.setTimeout(() => {
      this.#state.isTransitioning = false;
    }, CONFIG.TRANSITION_DURATION);
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Programmatically open the footer.
   */
  open() {
    this.#toggleFooter(true);
  }

  /**
   * Programmatically close the footer.
   */
  close() {
    this.#toggleFooter(false);
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

    const createTriggerHandler = (selector, action) => (e) => {
      const target = /** @type {Element} */ (e.target);

      if (target.closest(selector)) {
        e.preventDefault();
        e.stopPropagation();
        action();
      }
    };

    this.#addListener(
      'document:footerTrigger',
      document,
      'click',
      createTriggerHandler('[data-footer-trigger]', () =>
        this.#toggleFooter(true),
      ),
    );

    // legacy event from earlier versions has been removed; other
    // modules should call the exported `closeFooter()` helper instead.

    this.#addListener(
      'this:cookieTrigger',
      this,
      'click',
      createTriggerHandler('[data-cookie-trigger]', () => this.#openSettings()),
    );

    if (closeBtn) {
      this.#addListener('closeBtn:click', closeBtn, 'click', () =>
        this.#closeSettings(),
      );
    }

    if (footerMin) {
      const isInteractive = (/** @type {Element} */ target) =>
        target.closest('a, button, input, .cookie-inline');

      this.#addListener('footerMin:click', footerMin, 'click', (e) => {
        if (isInteractive(/** @type {Element} */ (e.target))) return;

        if (this.#state.isTransitioning) {
          e.preventDefault();
          return;
        }

        this.#toggleFooter();
      });

      this.#addListener('footerMin:keydown', footerMin, 'keydown', (e) => {
        const keyEvent = /** @type {KeyboardEvent} */ (e);

        if (
          (keyEvent.key === 'Enter' || keyEvent.key === ' ') &&
          !isInteractive(/** @type {Element} */ (keyEvent.target))
        ) {
          keyEvent.preventDefault();
          this.#toggleFooter();
        }
      });
    }

    this.#bindSettingsButtons();
  }

  #saveSettings(consentType, analyticsEnabled, messageKey) {
    CookieManager.set('cookie_consent', consentType);
    this.#analytics.updateConsent(analyticsEnabled);

    if (analyticsEnabled) {
      this.#analytics.load();
    } else {
      CookieManager.deleteAnalytics();
    }

    this.#elements.cookieBanner?.classList.add('hidden');
    a11y?.announce(i18n.t(messageKey), { priority: 'polite' });
    this.#closeSettings();
  }

  #bindSettingsButtons() {
    const { rejectAll, acceptSelected, acceptAll, analyticsToggle } =
      this.#elements;

    if (rejectAll) {
      this.#addListener('rejectAll:click', rejectAll, 'click', () => {
        this.#saveSettings('rejected', false, 'footer.messages.necessary_only');
      });
    }

    if (acceptSelected) {
      this.#addListener('acceptSelected:click', acceptSelected, 'click', () => {
        const toggle = /** @type {HTMLInputElement|null} */ (analyticsToggle);
        const analyticsEnabled = toggle?.checked ?? false;

        this.#saveSettings(
          analyticsEnabled ? 'accepted' : 'rejected',
          analyticsEnabled,
          'footer.messages.saved',
        );
      });
    }

    if (acceptAll) {
      this.#addListener('acceptAll:click', acceptAll, 'click', () => {
        this.#saveSettings('accepted', true, 'footer.messages.all_accepted');
      });
    }
  }

  #setupLanguageUpdates() {
    const unsubscribe = i18n.subscribe(() => {
      i18n.translateElement(this);
    });

    this.#listeners.set('i18n:unsubscribe', unsubscribe);
  }
}

// Register Custom Element

customElements.define('site-footer', SiteFooter);

// Convenience functions for other modules that don't want to query the
// DOM or depend directly on the element class.
export function openFooter() {
  const el = /** @type {any} */ (document.querySelector('site-footer'));
  if (el && typeof el.open === 'function') {
    el.open();
  }
}
export function closeFooter() {
  const el = /** @type {any} */ (document.querySelector('site-footer'));
  if (el && typeof el.close === 'function') {
    el.close();
  }
}
