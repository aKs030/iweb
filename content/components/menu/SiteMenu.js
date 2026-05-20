// @ts-check
/**
 * Modern Site Menu Web Component
 * Encapsulates the menu controller and its subsystems.
 * @version 1.0.0
 */

import { MenuRenderer } from "./modules/MenuRenderer.js";
import { MenuState } from "./modules/MenuState.js";
import { MenuEvents } from "./modules/MenuEvents.js";
import { MenuSearch } from "./modules/MenuSearch.js";
import { MenuAccessibility } from "./modules/MenuAccessibility.js";
import { MenuPerformance } from "./modules/MenuPerformance.js";
import { MenuConfig } from "./modules/MenuConfig.js";
import {
  OVERLAY_MODES,
  initOverlayManager,
  registerOverlayController,
} from "../../core/overlay-manager.js";
import { applyCspNonce } from "../../core/utils/csp-nonce.js";
import { loadHeadStylesheet, upsertHeadLink } from "../../core/utils/dom-utils.js";
import { fetchText } from "../../core/utils/fetch.js";
import { createLogger } from "../../core/logger.js";

/**
 * @typedef {typeof import('./modules/MenuConfig.js').MenuConfig} MenuComponentConfig
 */

const logger = createLogger("SiteMenu");
const SHADOW_DOM_ATTR = "data-shadow-dom";
const shadowCssCache = new Map();
const shadowSheetCache = new Map();

class SiteMenu extends HTMLElement {
  constructor() {
    super();
    /** @type {MenuComponentConfig} */
    this.config = { ...MenuConfig };
    this.state = new MenuState();
    this.renderer = /** @type {any} */ (new MenuRenderer(this.state, this.config));
    this.performance = new MenuPerformance();
    /** @type {MenuEvents|null} */
    this.events = null;
    /** @type {MenuSearch|null} */
    this.search = null;
    /** @type {MenuAccessibility|null} */
    this.accessibility = null;
    /** @type {HTMLElement|ShadowRoot} */
    this.domRoot = this;
    this.usesShadowDOM = false;
    this.shadowStyleElement = null;
    this.initialized = false;
    /** @type {Array<() => void>} */
    this._overlayControllerCleanupFns = [];
    this._deferredStylesPromise = null;
    this._deferredStylesReady = false;
  }

  async connectedCallback() {
    this.performance.startMeasure("menu-init");

    try {
      initOverlayManager();
      this.usesShadowDOM = this.isShadowDOMEnabled();
      if (this.usesShadowDOM && !this.shadowRoot) {
        this.attachShadow({ mode: "open" });
      }
      this.domRoot = this.shadowRoot || this;

      await this.ensureStyles();

      // Render menu
      const renderer = /** @type {any} */ (this.renderer);
      renderer.render(this.domRoot);

      // Initialize subsystems
      const accessibility = /** @type {any} */ (
        new MenuAccessibility(this.domRoot, this.state, this.config)
      );
      this.accessibility = accessibility;

      this.search = new MenuSearch(this.domRoot, this.state, this.config, this);

      this.events = new MenuEvents(
        this.domRoot,
        this.state,
        this.renderer,
        this.search,
        this.config,
        this
      );

      accessibility.init();
      this.search.init();
      this.events.init();
      this.registerOverlayControllers();

      this.initialized = true;

      const duration = this.performance.endMeasure("menu-init");
      logger.debug(`Initialized in ${duration.toFixed(2)}ms`);

      this.dispatchEvent(new CustomEvent("menu:loaded", { bubbles: true }));
    } catch (error) {
      logger.error("Initialization failed:", error);
    }
  }

  disconnectedCallback() {
    this._overlayControllerCleanupFns.forEach(cleanup => cleanup());
    this._overlayControllerCleanupFns = [];
    this.events?.destroy();
    this.search?.destroy();
    const accessibility = /** @type {any} */ (this.accessibility);
    accessibility?.destroy();
    this.performance?.destroy();
    this.state.reset();
    this.initialized = false;
  }

  open() {
    this.events?.setMenuOpenWithTransition(true);
  }

  close(options = {}) {
    this.events?.closeMenu(options);
  }

  getOverlayRoot() {
    const header = this.closest("header.site-header");
    return header instanceof HTMLElement ? header : this;
  }

  registerOverlayControllers() {
    this._overlayControllerCleanupFns.forEach(cleanup => cleanup());
    this._overlayControllerCleanupFns = [];

    /** @type {import('../../core/types.js').OverlayController} */
    const menuOverlayController = {
      close: ({ restoreFocus = true } = {}) => {
        this.events?.closeMenu({ restoreFocus });
      },
      getInteractiveRoots: () => [this.getOverlayRoot()],
      getFocusTrapRoots: () => this.events?.getFocusTrapRoots() || [],
      getPrimaryFocusTarget: () => {
        const target = this.events?.getPrimaryFocusTarget();
        return target instanceof HTMLElement ? target : null;
      },
      getRestoreFocusTarget: () => {
        const target = this.events?.getRestoreFocusTarget();
        return target instanceof HTMLElement ? target : null;
      },
    };

    /** @type {import('../../core/types.js').OverlayController} */
    const searchOverlayController = {
      close: ({ restoreFocus = true } = {}) => {
        this.search?.closeSearchMode({ restoreFocus });
      },
      getInteractiveRoots: () => [this.getOverlayRoot()],
      getFocusTrapRoots: () => this.search?.getFocusTrapRoots() || [],
      getPrimaryFocusTarget: () => {
        const target = this.search?.getPrimaryFocusTarget();
        return target instanceof HTMLElement ? target : null;
      },
      getRestoreFocusTarget: () => {
        const target = this.search?.getRestoreFocusTarget();
        return target instanceof HTMLElement ? target : null;
      },
    };

    this._overlayControllerCleanupFns.push(
      registerOverlayController(OVERLAY_MODES.MENU, menuOverlayController),
      registerOverlayController(OVERLAY_MODES.SEARCH, searchOverlayController)
    );
  }

  isShadowDOMEnabled() {
    if (this.getAttribute(SHADOW_DOM_ATTR) === "false") return false;
    if (this.hasAttribute(SHADOW_DOM_ATTR)) return true;
    return /** @type {any} */ (globalThis).__SITE_MENU_SHADOW__ === true;
  }

  /**
   * @param {any} urls
   * @returns {string[]}
   */
  dedupeCssUrls(urls) {
    const filteredUrls = (Array.isArray(urls) ? urls : []).filter(
      /** @param {string | null | undefined | false} url @returns {url is string} */
      url => typeof url === "string" && url.length > 0
    );
    return [...new Set(filteredUrls)];
  }

  getCssUrls() {
    const fallbackUrls = [
      "/content/components/menu/styles/menu-base.css",
      "/content/components/menu/styles/menu-states.css",
      "/content/components/menu/styles/menu-mobile.css",
    ];
    const configuredUrls = Array.isArray(this.config.CSS_URLS)
      ? this.config.CSS_URLS
      : fallbackUrls;

    return this.dedupeCssUrls(configuredUrls);
  }

  getDeferredCssUrls() {
    return this.dedupeCssUrls(this.config.DEFERRED_CSS_URLS);
  }

  getShadowCssUrls(allCssUrls = this.getCssUrls()) {
    if (Array.isArray(this.config.SHADOW_CSS_URLS)) {
      return this.dedupeCssUrls(this.config.SHADOW_CSS_URLS);
    }

    return allCssUrls;
  }

  getDeferredShadowCssUrls(allCssUrls = this.getDeferredCssUrls()) {
    if (Array.isArray(this.config.DEFERRED_SHADOW_CSS_URLS)) {
      return this.dedupeCssUrls(this.config.DEFERRED_SHADOW_CSS_URLS);
    }

    return allCssUrls;
  }

  /**
   * @param {string[]} cssUrls
   * @param {string} [injectedBy]
   */
  ensureHeadStyles(cssUrls, injectedBy = "site-menu") {
    if (!cssUrls.length) return;

    for (const cssUrl of cssUrls) {
      const existing = document.head.querySelector(`link[href="${cssUrl}"]`);
      if (existing) continue;

      upsertHeadLink({
        rel: "stylesheet",
        href: cssUrl,
        attrs: { media: "all" },
        dataset: { injectedBy },
      });
    }
  }


  /**
   * @param {string[]} cssUrls
   * @param {string} [injectedBy]
   */
  ensureHeadStylesAsync(cssUrls, injectedBy = "site-menu-deferred") {
    if (!cssUrls.length) return Promise.resolve([]);

    return Promise.all(cssUrls.map(cssUrl => loadHeadStylesheet(cssUrl, { injectedBy })));
  }

  async ensureStyles() {
    if (typeof document === "undefined") return;
    const allCssUrls = this.getCssUrls();
    if (allCssUrls.length === 0) return;

    if (this.usesShadowDOM && this.shadowRoot) {
      const shadowCssUrls = this.getShadowCssUrls(allCssUrls);
      if (shadowCssUrls.length === 0) return;

      const sheets = await this.getShadowStylesheets(shadowCssUrls);

      if (sheets.length > 0 && "adoptedStyleSheets" in this.shadowRoot) {
        const mergedSheets = [...this.shadowRoot.adoptedStyleSheets];
        for (const sheet of sheets) {
          if (!mergedSheets.includes(sheet)) {
            mergedSheets.push(sheet);
          }
        }

        if (mergedSheets.length !== this.shadowRoot.adoptedStyleSheets.length) {
          this.shadowRoot.adoptedStyleSheets = mergedSheets;
        }
        return;
      }

      const cssText = await this.getShadowScopedCssTextBatch(shadowCssUrls);
      if (!cssText) return;

      if (!this.shadowStyleElement) {
        this.shadowStyleElement = document.createElement("style");
        this.shadowStyleElement.dataset.injectedBy = "site-menu-shadow";
        applyCspNonce(this.shadowStyleElement);
        this.shadowRoot.appendChild(this.shadowStyleElement);
      }

      this.shadowStyleElement.textContent = cssText;
      return;
    }

    this.ensureHeadStyles(allCssUrls, "site-menu");
  }

  async ensureDeferredStyles() {
    if (this._deferredStylesReady) return;
    if (this._deferredStylesPromise) return this._deferredStylesPromise;

    const deferredCssUrls = this.getDeferredCssUrls();
    if (deferredCssUrls.length === 0) {
      this._deferredStylesReady = true;
      return;
    }

    this._deferredStylesPromise = (async () => {
      if (this.usesShadowDOM && this.shadowRoot) {
        const shadowCssUrls = this.getDeferredShadowCssUrls(deferredCssUrls);
        if (shadowCssUrls.length > 0) {
          const sheets = await this.getShadowStylesheets(shadowCssUrls);

          if (sheets.length > 0 && "adoptedStyleSheets" in this.shadowRoot) {
            const mergedSheets = [...this.shadowRoot.adoptedStyleSheets];
            for (const sheet of sheets) {
              if (!mergedSheets.includes(sheet)) {
                mergedSheets.push(sheet);
              }
            }
            this.shadowRoot.adoptedStyleSheets = mergedSheets;
          } else {
            const cssText = await this.getShadowScopedCssTextBatch(shadowCssUrls);
            if (cssText) {
              if (!this.shadowStyleElement) {
                this.shadowStyleElement = document.createElement("style");
                this.shadowStyleElement.dataset.injectedBy = "site-menu-shadow";
                applyCspNonce(this.shadowStyleElement);
                this.shadowRoot.appendChild(this.shadowStyleElement);
              }
              this.shadowStyleElement.textContent = [
                this.shadowStyleElement.textContent || "",
                cssText,
              ]
                .filter(Boolean)
                .join("\n");
            }
          }
        }

        this._deferredStylesReady = true;
      } else {
        await this.ensureHeadStylesAsync(deferredCssUrls, "site-menu-deferred");
        this._deferredStylesReady = true;
      }
    })()
      .catch(error => {
        this._deferredStylesPromise = null;
        logger.warn("Failed to load deferred menu styles:", error);
      })
      .finally(() => {
        this._deferredStylesPromise = null;
      });

    return this._deferredStylesPromise;
  }

  /**
   * @param {string[]} cssUrls
   */
  async getShadowScopedCssTextBatch(cssUrls) {
    const chunks = await Promise.all(cssUrls.map(cssUrl => this.getShadowScopedCssText(cssUrl)));
    return chunks.filter(Boolean).join("\n");
  }

  /**
   * @param {string[]} cssUrls
   */
  async getShadowStylesheets(cssUrls) {
    const entries = await Promise.all(cssUrls.map(cssUrl => this.getShadowStylesheet(cssUrl)));
    /** @type {CSSStyleSheet[]} */
    const sheets = [];
    for (const sheet of entries) {
      if (sheet) sheets.push(sheet);
    }
    return sheets;
  }

  /**
   * @param {string} cssUrl
   */
  async getShadowScopedCssText(cssUrl) {
    const cached = shadowCssCache.get(cssUrl);
    if (cached) return cached;

    const promise = fetchText(cssUrl, {
      fetchOptions: { credentials: "same-origin" },
      retries: 1,
    }).then(
      /** @param {string} rawCss */
      rawCss => this.transformCssForShadow(rawCss)
    );

    shadowCssCache.set(cssUrl, promise);

    try {
      return await promise;
    } catch (error) {
      shadowCssCache.delete(cssUrl);
      logger.warn("Failed to build shadow CSS, falling back to light DOM:", error);
      return "";
    }
  }

  /**
   * @param {string} cssUrl
   */
  async getShadowStylesheet(cssUrl) {
    const supportsConstructable =
      typeof CSSStyleSheet !== "undefined" &&
      "replace" in CSSStyleSheet.prototype &&
      typeof ShadowRoot !== "undefined" &&
      "adoptedStyleSheets" in ShadowRoot.prototype;

    if (!supportsConstructable) return null;

    const cached = shadowSheetCache.get(cssUrl);
    if (cached) return cached;

    const promise = this.getShadowScopedCssText(cssUrl).then(async cssText => {
      if (!cssText) return null;
      const sheet = new CSSStyleSheet();
      await sheet.replace(cssText);
      return sheet;
    });

    shadowSheetCache.set(cssUrl, promise);

    try {
      return await promise;
    } catch (error) {
      shadowSheetCache.delete(cssUrl);
      logger.warn("Failed to create constructable stylesheet:", error);
      return null;
    }
  }

  /**
   * @param {string} rawCss
   */
  transformCssForShadow(rawCss) {
    const withHostSelector = String(rawCss || "").replace(/(^|\n)\s*site-menu\s*\{/g, "$1:host {");

    const withHostContext = withHostSelector.replace(
      /(^|[,{]\s*)\.site-header\.search-mode/g,
      "$1:host-context(.site-header.search-mode)"
    );

    return withHostContext;
  }

}

if (!customElements.get("site-menu")) {
  customElements.define("site-menu", SiteMenu);
}
