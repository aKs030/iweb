// @ts-check

/**
 * Modern Site Footer Web Component v3.1.0
 * Optimized architecture with complete memory leak prevention.
 * @version 3.1.0
 */

import { createLogger } from "../../core/logger.js";
import { a11y } from "../../core/accessibility-manager.js";
import { i18n } from "../../core/i18n.js";
import {
  closeOverlay,
  initOverlayManager,
  openOverlay,
  OVERLAY_MODES,
  registerOverlayController,
  toggleOverlay,
} from "../../core/overlay-manager.js";
import { CookieManager } from "./modules/cookie-manager.js";
import { AnalyticsManager } from "./footer-analytics.js";
import { resetFooterState, setFooterLoaded } from "./state.js";
import { fetchText, TimerManager } from "../../core/utils/index.js";

const log = createLogger("SiteFooter");
const FOOTER_TEMPLATE_URL = new URL("./footer", import.meta.url);
const CONSENT_COOKIE = "cookie_consent";
const ANALYTICS_CONSENT_COOKIE = "cookie_analytics_consent";
const ADS_CONSENT_COOKIE = "cookie_ads_consent";

let footerTemplatePromise = null;

/**
 * @typedef {Object} FooterElements
 * @property {HTMLElement|null} footer
 * @property {HTMLElement|null} footerMin
 * @property {HTMLElement|null} footerMax
 * @property {HTMLElement|null} cookieBanner
 * @property {HTMLElement|null} cookieSettings
 * @property {HTMLElement|null} footerContent
 * @property {HTMLButtonElement|null} acceptBtn
 * @property {HTMLButtonElement|null} rejectBtn
 * @property {HTMLButtonElement|null} closeBtn
 * @property {HTMLInputElement|null} analyticsToggle
 * @property {HTMLInputElement|null} adsToggle
 * @property {HTMLButtonElement|null} rejectAll
 * @property {HTMLButtonElement|null} acceptSelected
 * @property {HTMLButtonElement|null} acceptAll
 */

async function loadFooterTemplate() {
  footerTemplatePromise ||= fetchText(FOOTER_TEMPLATE_URL, {
    fetchOptions: {
      headers: { Accept: "text/html" },
    },
    retries: 1,
  });

  try {
    return await footerTemplatePromise;
  } catch (error) {
    footerTemplatePromise = null;
    throw error;
  }
}

function parseFooterTemplate(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const fragment = document.createDocumentFragment();
  fragment.append(...Array.from(doc.body.childNodes));
  return fragment;
}

/**
 * SiteFooter Custom Element

 */

export class SiteFooter extends HTMLElement {
  #analytics = new AnalyticsManager();
  #timers = new TimerManager("SiteFooter");
  #listeners = new Map();
  #unsubscribeLanguage = null;
  #overlayCleanup = null;

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

  async connectedCallback() {
    try {
      const hasShell = this.dataset.shell === "true";
      const isEmpty = !this.firstElementChild && !this.textContent.trim();
      if (isEmpty || hasShell) {
        const html = await loadFooterTemplate();

        if (!this.isConnected) return;

        this.replaceChildren(parseFooterTemplate(html));
        delete this.dataset.shell;
      }

      this.#init();

      initOverlayManager();
      this.#registerOverlayController();

      this.#setupLanguageUpdates();

      this.#setupGlobalEventListeners();

      log.info("Footer initialized");
      setFooterLoaded(true);
    } catch (error) {
      log.error("Footer load failed", error);
    }
  }

  disconnectedCallback() {
    this.#cleanup();
  }

  /**
   * Complete cleanup of all event listeners and resources
   */
  #cleanup() {
    this.#listeners.forEach(({ element, event, handler, options }) => {
      element.removeEventListener(event, handler, options);
    });
    this.#listeners.clear();
    this.#timers.clearAll();

    void closeOverlay(OVERLAY_MODES.FOOTER, {
      reason: "component-disconnect",
      restoreFocus: false,
    });
    this.#overlayCleanup?.();
    this.#overlayCleanup = null;

    this.#unsubscribeLanguage?.();
    this.#unsubscribeLanguage = null;

    resetFooterState();

    log.info("Footer cleanup complete");
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

    this.#listeners.set(key, { element, event, handler, options });
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
      footer: this.querySelector("footer.site-footer"),
      footerMin: this.querySelector(".footer-min"),
      footerMax: this.querySelector(".footer-max"),
      cookieBanner: this.querySelector("#cookie-banner"),
      cookieSettings: this.querySelector("#cookie-settings"),
      footerContent: this.querySelector("#footer-content"),
      acceptBtn: this.querySelector("#accept-cookies"),
      rejectBtn: this.querySelector("#reject-cookies"),
      closeBtn: this.querySelector("#close-settings"),
      analyticsToggle: this.querySelector("#analytics-toggle"),
      adsToggle: this.querySelector("#ads-toggle"),
      rejectAll: this.querySelector("#reject-all"),
      acceptSelected: this.querySelector("#accept-selected"),
      acceptAll: this.querySelector("#accept-all"),
    };

    // Footer height uses a fixed base constant when updating the CSS variable.
  }

  #setupDate() {
    // Update dynamic texts safely
    try {
      const currentYear = new Date().getFullYear().toString();
      this.querySelectorAll(".year").forEach(el => (el.textContent = currentYear));
    } catch {
      // Ignored intentionally
    }
  }

  #setupCookieBanner() {
    const { cookieBanner, acceptBtn, rejectBtn } = this.#elements;

    if (!cookieBanner || !acceptBtn || !rejectBtn) return;

    const { resolved, analytics, ads } = this.#getConsentPreferences();
    const shouldShow = !resolved;

    cookieBanner.classList.toggle("hidden", !shouldShow);

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

    this.#addListener("acceptBtn:click", acceptBtn, "click", e => {
      e.stopPropagation();

      this.#handleConsent("accepted");
    });

    this.#addListener("rejectBtn:click", rejectBtn, "click", e => {
      e.stopPropagation();

      this.#handleConsent("rejected");
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
      root.style.setProperty("--footer-height", `${76 + bannerHeight}px`);

      root.classList.toggle("footer-cookie-visible", !!showBanner);
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

    const analyticsEnabled = type === "accepted";
    const adsEnabled = false;
    cookieBanner.classList.add("hidden");
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

    a11y?.announce(i18n.t(`footer.messages.${type}`), { priority: "polite" });
  }

  #setupGlobalEventListeners() {
    /** @type {EventListener} */

    const handleOutsideClick = e => {
      if (!this.#elements.footer?.classList.contains("expanded")) return;

      if (!(e.target instanceof Element)) return;
      const target = e.target;
      if (target.closest("[data-footer-trigger]")) {
        return;
      }

      if (!target.closest("site-footer")) {
        e.preventDefault();
        e.stopPropagation();
        void closeOverlay(OVERLAY_MODES.FOOTER, {
          reason: "outside-click",
          restoreFocus: false,
        });
      }
    };

    this.#addListener("document:click", document, "click", handleOutsideClick);
  }

  #registerOverlayController() {
    this.#overlayCleanup?.();
    this.#overlayCleanup = registerOverlayController(OVERLAY_MODES.FOOTER, {
      open: () => this.#applyExpandedState(true),
      close: () => this.#applyExpandedState(false),
      getInteractiveRoots: () => [this],
      getFocusTrapRoots: () =>
        this.#elements.footerMax instanceof HTMLElement ? [this.#elements.footerMax] : [],
      getPrimaryFocusTarget: () => {
        const { cookieSettings, footerContent } = this.#elements;
        const visibleContent = cookieSettings?.classList.contains("hidden")
          ? footerContent
          : cookieSettings;

        return (
          visibleContent?.querySelector('button, a, input, [tabindex]:not([tabindex="-1"])') || null
        );
      },
    });
  }

  /**
   * @param {boolean} [forceState]
   */
  #applyExpandedState(newState) {
    const { footer, footerMin, footerMax } = this.#elements;

    if (!footer) return;

    if (newState === footer.classList.contains("expanded")) return;

    if (!newState) {
      this.#restoreExpandedContent();
    }

    const footerTriggers = document.querySelectorAll("[data-footer-trigger]");

    footer.classList.toggle("expanded", newState);

    footerMin?.classList.toggle("hidden", newState);
    footerMax?.classList.toggle("hidden", !newState);

    const ariaState = String(newState);
    footerTriggers.forEach(t => t.setAttribute("aria-expanded", ariaState));

    const actionKey = newState ? "expanded" : "minimize";
    a11y?.announce(i18n.t(`footer.actions.${actionKey}`), {
      priority: "polite",
    });
  }

  #openSettings() {
    const { cookieSettings, footerContent, analyticsToggle, adsToggle } = this.#elements;

    if (!cookieSettings) return;

    const { analytics, ads } = this.#getConsentPreferences();

    if (analyticsToggle) {
      /** @type {HTMLInputElement} */ (analyticsToggle).checked = analytics;
    }

    if (adsToggle) {
      /** @type {HTMLInputElement} */ (adsToggle).checked = ads;
    }

    if (!this.#elements.footer?.classList.contains("expanded")) {
      void openOverlay(OVERLAY_MODES.FOOTER, { reason: "cookie-settings" });
    }

    cookieSettings.classList.remove("hidden");

    footerContent?.classList.add("hidden");

    const closeBtn = /** @type {HTMLElement|null} */ (
      cookieSettings.querySelector("#close-settings")
    );

    if (closeBtn) {
      this.#timers.setTimeout(() => closeBtn.focus(), 100);
    }

    a11y?.announce(i18n.t("footer.messages.opened"), { priority: "polite" });
  }

  #closeSettings() {
    this.#restoreExpandedContent({ announce: true });
  }

  #bindEvents() {
    const { closeBtn, footerMin, footerMax } = this.#elements;
    const isInteractiveTarget = target =>
      Boolean(
        target.closest(
          "a, button, input, label, select, textarea, [contenteditable], .cookie-settings"
        )
      );

    const createTriggerHandler = (selector, action) => e => {
      if (!(e.target instanceof Element)) return;
      const target = e.target;

      if (target.closest(selector)) {
        e.preventDefault();
        e.stopPropagation();
        action();
      }
    };

    this.#addListener(
      "document:footerTrigger",
      document,
      "click",
      createTriggerHandler("[data-footer-trigger]", () => {
        void openOverlay(OVERLAY_MODES.FOOTER, { reason: "footer-trigger" });
      })
    );

    this.#addListener(
      "this:cookieTrigger",
      this,
      "click",
      createTriggerHandler("[data-cookie-trigger]", () => this.#openSettings())
    );

    if (closeBtn) {
      this.#addListener("closeBtn:click", closeBtn, "click", () => this.#closeSettings());
    }

    if (footerMin) {
      this.#addListener("footerMin:click", footerMin, "click", e => {
        if (!(e.target instanceof Element)) return;
        if (isInteractiveTarget(e.target)) return;

        e.preventDefault();
        e.stopPropagation();
        void toggleOverlay(OVERLAY_MODES.FOOTER, { reason: "footer-surface" });
      });
    }

    if (footerMax) {
      this.#addListener("footerMax:click", footerMax, "click", e => {
        if (!(e.target instanceof Element)) return;
        if (isInteractiveTarget(e.target)) return;

        e.preventDefault();
        e.stopPropagation();
        void toggleOverlay(OVERLAY_MODES.FOOTER, {
          reason: "footer-surface",
          restoreFocus: false,
        });
      });
    }

    this.#bindSettingsButtons();
  }

  #restoreExpandedContent({ announce = false } = {}) {
    const { cookieSettings, footerContent } = this.#elements;

    cookieSettings?.classList.add("hidden");
    footerContent?.classList.remove("hidden");

    if (announce) {
      a11y?.announce(i18n.t("footer.messages.closed"), { priority: "polite" });
    }
  }

  #getConsentPreferences() {
    const consent = CookieManager.get(CONSENT_COOKIE);
    const resolved = consent === "accepted" || consent === "rejected";
    const legacyAccepted = consent === "accepted";
    const analyticsConsent = CookieManager.get(ANALYTICS_CONSENT_COOKIE);
    const adsConsent = CookieManager.get(ADS_CONSENT_COOKIE);

    return {
      resolved,
      analytics: analyticsConsent === null ? legacyAccepted : analyticsConsent === "accepted",
      ads: adsConsent === null ? legacyAccepted : adsConsent === "accepted",
    };
  }

  #persistConsentPreferences({ analytics, ads }) {
    CookieManager.set(CONSENT_COOKIE, analytics || ads ? "accepted" : "rejected");
    CookieManager.set(ANALYTICS_CONSENT_COOKIE, analytics ? "accepted" : "rejected");
    CookieManager.set(ADS_CONSENT_COOKIE, ads ? "accepted" : "rejected");
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

    this.#elements.cookieBanner?.classList.add("hidden");
    this.#updateFooterHeight(false);
    a11y?.announce(i18n.t(messageKey), { priority: "polite" });
    this.#closeSettings();
  }

  #bindSettingsButtons() {
    const { rejectAll, acceptSelected, acceptAll, analyticsToggle } = this.#elements;

    if (rejectAll) {
      this.#addListener("rejectAll:click", rejectAll, "click", () => {
        this.#saveSettings({
          analyticsEnabled: false,
          adsEnabled: false,
          messageKey: "footer.messages.necessary_only",
        });
      });
    }

    if (acceptSelected) {
      this.#addListener("acceptSelected:click", acceptSelected, "click", () => {
        const analyticsInput = /** @type {HTMLInputElement|null} */ (analyticsToggle);
        const adsInput = /** @type {HTMLInputElement|null} */ (this.#elements.adsToggle);

        this.#saveSettings({
          analyticsEnabled: analyticsInput?.checked ?? false,
          adsEnabled: adsInput?.checked ?? false,
          messageKey: "footer.messages.saved",
        });
      });
    }

    if (acceptAll) {
      this.#addListener("acceptAll:click", acceptAll, "click", () => {
        this.#saveSettings({
          analyticsEnabled: true,
          adsEnabled: true,
          messageKey: "footer.messages.all_accepted",
        });
      });
    }
  }

  #setupLanguageUpdates() {
    this.#unsubscribeLanguage?.();
    this.#unsubscribeLanguage = i18n.subscribe(() => {
      i18n.translateElement(this);
    });
  }
}

// Register Custom Element

customElements.define("site-footer", SiteFooter);
