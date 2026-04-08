// @ts-check

/**
 * Modern Site Footer Web Component v3.1.0
 * Optimized architecture with complete memory leak prevention.
 * @version 3.1.0
 */

import { createLogger } from '#core/logger.js';
import { a11y } from '#core/accessibility-manager.js';
import { i18n } from '#core/i18n.js';
import { CookieManager } from '#core/cookie-manager.js';
import { AnalyticsManager } from './footer-analytics.js';
import {
  resetFooterState,
  setFooterExpanded,
  setFooterLoaded,
} from './state.js';
import { TimerManager } from '#core/timer-manager.js';
import { FOOTER_HTML } from './footer-template.generated.js';

const log = createLogger('SiteFooter');
const CONSENT_COOKIE = 'cookie_consent';
const ANALYTICS_CONSENT_COOKIE = 'cookie_analytics_consent';
const ADS_CONSENT_COOKIE = 'cookie_ads_consent';

/** @typedef {import('./footer.types.js').FooterElements} FooterElements */

/**
 * SiteFooter Custom Element

 */

export class SiteFooter extends HTMLElement {
  #analytics = new AnalyticsManager();
  #timers = new TimerManager('SiteFooter');
  #listeners = new Map();

  #state = {
    expanded: false,
    initialized: false,
    touchStartY: 0,
    touchStartTime: 0,
    touchStartedOnInteractive: false,
  };

  /** @type {FooterElements} */
  #elements = {
    footer: null,
    footerMin: null,
    footerMinMain: null,
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

  async connectedCallback() {
    try {
      const hasShell = this.dataset.shell === 'true';
      if (!this.innerHTML.trim() || hasShell) {
        const html = FOOTER_HTML;

        if (!this.isConnected) return;

        this.innerHTML = html;
        delete this.dataset.shell;
      }

      this.#init();

      this.#setupLanguageUpdates();

      this.#setupGlobalEventListeners();

      this.#state.initialized = true;

      log.info('Footer initialized');
      setFooterLoaded(true);
      setFooterExpanded(this.#state.expanded);
    } catch (error) {
      log.error('Footer load failed', error);
    }
  }

  disconnectedCallback() {
    this.#cleanup();
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
    resetFooterState();

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
      // the `<footer>` element inside the custom element;
      footer: this.querySelector('footer.site-footer'),
      footerMin: this.querySelector('.footer-min'),
      footerMinMain: this.querySelector('.footer-min-main'),
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

    // Footer height uses a fixed base constant when updating the CSS variable.
  }

  #setupDate() {
    // Update dynamic texts safely
    try {
      const currentYear = new Date().getFullYear().toString();
      this.querySelectorAll('.year').forEach(
        (el) => (el.textContent = currentYear),
      );
    } catch {
      // Ignored intentionally
    }
  }

  #setupCookieBanner() {
    const { cookieBanner, acceptBtn, rejectBtn } = this.#elements;

    if (!cookieBanner || !acceptBtn || !rejectBtn) return;

    const { resolved, analytics, ads } = this.#getConsentPreferences();
    const shouldShow = !resolved;

    cookieBanner.classList.toggle('hidden', !shouldShow);

    // Adjust footer height for cookie banner

    this.#updateFooterHeight(shouldShow);

    // Load analytics if already accepted

    if (resolved) {
      this.#analytics.updateConsent({ analytics, ads });

      if (analytics) {
        this.#analytics.load();
      } else {
        CookieManager.deleteAnalytics();
      }
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

    const analyticsEnabled = type === 'accepted';
    const adsEnabled = false;
    cookieBanner.classList.add('hidden');
    this.#updateFooterHeight(false);

    this.#persistConsentPreferences({
      analytics: analyticsEnabled,
      ads: adsEnabled,
    });
    this.#analytics.updateConsent({
      analytics: analyticsEnabled,
      ads: adsEnabled,
    });

    if (analyticsEnabled) {
      this.#analytics.load();
    } else {
      CookieManager.deleteAnalytics();
    }

    a11y?.announce(i18n.t(`footer.messages.${type}`), { priority: 'polite' });
  }

  #setupGlobalEventListeners() {
    const isInteractiveTarget = (target) =>
      target instanceof Element &&
      Boolean(target.closest('a, button, input, label, .cookie-inline'));

    /** @type {EventListener} */

    const handleOutsideClick = (e) => {
      if (!this.#state.expanded) return;

      if (!(e.target instanceof Element)) return;
      const target = e.target;
      if (target.closest('[data-footer-trigger]')) {
        return;
      }

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
      this.#state.touchStartedOnInteractive = isInteractiveTarget(
        touchEvent.target,
      );
    };

    /** @type {EventListener} */
    const handleTouchEnd = (e) => {
      const touchEvent = /** @type {TouchEvent} */ (e);
      if (
        this.#state.touchStartedOnInteractive ||
        isInteractiveTarget(touchEvent.target)
      ) {
        this.#state.touchStartedOnInteractive = false;
        return;
      }

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

      this.#state.touchStartedOnInteractive = false;
    };

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
  }

  /**
   * @param {boolean} [forceState]
   */
  #toggleFooter(forceState) {
    const { footer, footerMin, footerMax } = this.#elements;

    if (!footer) return;

    const newState =
      forceState !== undefined ? forceState : !this.#state.expanded;

    if (newState === this.#state.expanded) return;

    this.#state.expanded = newState;

    if (!newState) {
      this.#restoreExpandedContent();
    }

    const footerTriggers = document.querySelectorAll('[data-footer-trigger]');

    footer.classList.toggle('expanded', newState);
    document.body.classList.toggle('footer-expanded', newState);

    footerMin?.classList.toggle('hidden', newState);
    footerMax?.classList.toggle('hidden', !newState);

    const ariaState = String(newState);
    footerTriggers.forEach((t) => t.setAttribute('aria-expanded', ariaState));

    const actionKey = newState ? 'expanded' : 'minimized';
    a11y?.announce(i18n.t(`footer.actions.${actionKey}`), {
      priority: 'polite',
    });
    setFooterExpanded(newState);

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

    const { analytics, ads } = this.#getConsentPreferences();

    if (analyticsToggle) {
      /** @type {HTMLInputElement} */ (analyticsToggle).checked = analytics;
    }

    if (adsToggle) {
      /** @type {HTMLInputElement} */ (adsToggle).checked = ads;
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
    this.#restoreExpandedContent({ announce: true });
  }

  #bindEvents() {
    const { closeBtn, footerMin } = this.#elements;

    const createTriggerHandler = (selector, action) => (e) => {
      if (!(e.target instanceof Element)) return;
      const target = e.target;

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
        target.closest('a, button, input, label, .cookie-inline');

      this.#addListener('footerMin:click', footerMin, 'click', (e) => {
        if (!(e.target instanceof Element)) return;
        if (isInteractive(e.target)) return;

        this.#toggleFooter();
      });
    }

    this.#bindSettingsButtons();
  }

  #restoreExpandedContent({ announce = false } = {}) {
    const { cookieSettings, footerContent } = this.#elements;

    cookieSettings?.classList.add('hidden');
    footerContent?.classList.remove('hidden');

    if (announce) {
      a11y?.announce(i18n.t('footer.messages.closed'), { priority: 'polite' });
    }
  }

  #getConsentPreferences() {
    const consent = CookieManager.get(CONSENT_COOKIE);
    const resolved = consent === 'accepted' || consent === 'rejected';
    const legacyAccepted = consent === 'accepted';
    const analyticsConsent = CookieManager.get(ANALYTICS_CONSENT_COOKIE);
    const adsConsent = CookieManager.get(ADS_CONSENT_COOKIE);

    return {
      resolved,
      analytics:
        analyticsConsent === null
          ? legacyAccepted
          : analyticsConsent === 'accepted',
      ads: adsConsent === null ? legacyAccepted : adsConsent === 'accepted',
    };
  }

  #persistConsentPreferences({ analytics, ads }) {
    CookieManager.set(
      CONSENT_COOKIE,
      analytics || ads ? 'accepted' : 'rejected',
    );
    CookieManager.set(
      ANALYTICS_CONSENT_COOKIE,
      analytics ? 'accepted' : 'rejected',
    );
    CookieManager.set(ADS_CONSENT_COOKIE, ads ? 'accepted' : 'rejected');
  }

  #saveSettings({ analyticsEnabled, adsEnabled, messageKey }) {
    this.#persistConsentPreferences({
      analytics: analyticsEnabled,
      ads: adsEnabled,
    });
    this.#analytics.updateConsent({
      analytics: analyticsEnabled,
      ads: adsEnabled,
    });

    if (analyticsEnabled) {
      this.#analytics.load();
    } else {
      CookieManager.deleteAnalytics();
    }

    this.#elements.cookieBanner?.classList.add('hidden');
    this.#updateFooterHeight(false);
    a11y?.announce(i18n.t(messageKey), { priority: 'polite' });
    this.#closeSettings();
  }

  #bindSettingsButtons() {
    const { rejectAll, acceptSelected, acceptAll, analyticsToggle } =
      this.#elements;

    if (rejectAll) {
      this.#addListener('rejectAll:click', rejectAll, 'click', () => {
        this.#saveSettings({
          analyticsEnabled: false,
          adsEnabled: false,
          messageKey: 'footer.messages.necessary_only',
        });
      });
    }

    if (acceptSelected) {
      this.#addListener('acceptSelected:click', acceptSelected, 'click', () => {
        const analyticsInput = /** @type {HTMLInputElement|null} */ (
          analyticsToggle
        );
        const adsInput = /** @type {HTMLInputElement|null} */ (
          this.#elements.adsToggle
        );

        this.#saveSettings({
          analyticsEnabled: analyticsInput?.checked ?? false,
          adsEnabled: adsInput?.checked ?? false,
          messageKey: 'footer.messages.saved',
        });
      });
    }

    if (acceptAll) {
      this.#addListener('acceptAll:click', acceptAll, 'click', () => {
        this.#saveSettings({
          analyticsEnabled: true,
          adsEnabled: true,
          messageKey: 'footer.messages.all_accepted',
        });
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
