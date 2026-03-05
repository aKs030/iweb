// @ts-check
/**
 * Modern Site Menu Web Component
 * Encapsulates the menu controller and its subsystems.
 * @version 1.0.0
 */

import { MenuRenderer } from './modules/MenuRenderer.js';
import { MenuState } from './modules/MenuState.js';
import { MenuEvents } from './modules/MenuEvents.js';
import { MenuSearch } from './modules/MenuSearch.js';
import { MenuAccessibility } from './modules/MenuAccessibility.js';
import { MenuPerformance } from './modules/MenuPerformance.js';
import { MenuConfig } from './modules/MenuConfig.js';
import { upsertHeadLink } from '../../core/utils.js';
import { createLogger } from '../../core/logger.js';

const logger = createLogger('SiteMenu');
const SHADOW_DOM_ATTR = 'data-shadow-dom';
const shadowCssCache = new Map();
const shadowSheetCache = new Map();

class SiteMenu extends HTMLElement {
  constructor() {
    super();
    this.config = { ...MenuConfig };
    this.state = new MenuState();
    this.renderer = /** @type {any} */ (
      new MenuRenderer(this.state, this.config)
    );
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
  }

  async connectedCallback() {
    this.performance.startMeasure('menu-init');

    try {
      this.usesShadowDOM = this.isShadowDOMEnabled();
      if (this.usesShadowDOM && !this.shadowRoot) {
        this.attachShadow({ mode: 'open' });
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
        this,
      );

      accessibility.init();
      this.search.init();
      this.events.init();

      this.initialized = true;

      const duration = this.performance.endMeasure('menu-init');
      logger.debug(`Initialized in ${duration.toFixed(2)}ms`);

      this.dispatchEvent(new CustomEvent('menu:loaded', { bubbles: true }));
    } catch (error) {
      logger.error('Initialization failed:', error);
    }
  }

  disconnectedCallback() {
    this.events?.destroy();
    this.search?.destroy();
    const accessibility = /** @type {any} */ (this.accessibility);
    accessibility?.destroy();
    this.performance?.destroy();
    this.state.reset();
    this.initialized = false;
  }

  isShadowDOMEnabled() {
    if (this.getAttribute(SHADOW_DOM_ATTR) === 'false') return false;
    if (this.hasAttribute(SHADOW_DOM_ATTR)) return true;
    return globalThis.__SITE_MENU_SHADOW__ === true;
  }

  dedupeCssUrls(urls) {
    return [...new Set((Array.isArray(urls) ? urls : []).filter(Boolean))];
  }

  getCssUrls() {
    const fallbackUrls = [
      '/content/components/menu/menu.css',
      '/content/components/menu/menu-responsive.css',
      '/content/components/menu/menu-backdrop.css',
    ];
    const configuredUrls = Array.isArray(this.config.CSS_URLS)
      ? this.config.CSS_URLS
      : this.config.CSS_URL
        ? [this.config.CSS_URL]
        : fallbackUrls;

    return this.dedupeCssUrls(configuredUrls);
  }

  getGlobalCssUrls() {
    return this.dedupeCssUrls(this.config.GLOBAL_CSS_URLS);
  }

  getShadowCssUrls(allCssUrls = this.getCssUrls()) {
    if (Array.isArray(this.config.SHADOW_CSS_URLS)) {
      return this.dedupeCssUrls(this.config.SHADOW_CSS_URLS);
    }

    const globalUrls = new Set(this.getGlobalCssUrls());
    return allCssUrls.filter((cssUrl) => !globalUrls.has(cssUrl));
  }

  ensureHeadStyles(cssUrls, injectedBy = 'site-menu') {
    if (!cssUrls.length) return;

    for (const cssUrl of cssUrls) {
      const existing = document.head.querySelector(`link[href="${cssUrl}"]`);
      if (existing) continue;

      upsertHeadLink({
        rel: 'stylesheet',
        href: cssUrl,
        attrs: { media: 'all' },
        dataset: { injectedBy },
      });
    }
  }

  async ensureStyles() {
    if (typeof document === 'undefined') return;
    const allCssUrls = this.getCssUrls();
    if (allCssUrls.length === 0) return;

    if (this.usesShadowDOM && this.shadowRoot) {
      this.ensureHeadStyles(this.getGlobalCssUrls(), 'site-menu-global');

      const shadowCssUrls = this.getShadowCssUrls(allCssUrls);
      if (shadowCssUrls.length === 0) return;

      const sheets = await this.getShadowStylesheets(shadowCssUrls);

      if (sheets.length > 0 && 'adoptedStyleSheets' in this.shadowRoot) {
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
        this.shadowStyleElement = document.createElement('style');
        this.shadowStyleElement.dataset.injectedBy = 'site-menu-shadow';
        this.shadowRoot.appendChild(this.shadowStyleElement);
      }

      this.shadowStyleElement.textContent = cssText;
      return;
    }

    this.ensureHeadStyles(allCssUrls, 'site-menu');
  }

  async getShadowScopedCssTextBatch(cssUrls) {
    const chunks = await Promise.all(
      cssUrls.map((cssUrl) => this.getShadowScopedCssText(cssUrl)),
    );
    return chunks.filter(Boolean).join('\n');
  }

  async getShadowStylesheets(cssUrls) {
    const entries = await Promise.all(
      cssUrls.map((cssUrl) => this.getShadowStylesheet(cssUrl)),
    );
    /** @type {CSSStyleSheet[]} */
    const sheets = [];
    for (const sheet of entries) {
      if (sheet) sheets.push(sheet);
    }
    return sheets;
  }

  async getShadowScopedCssText(cssUrl) {
    const cached = shadowCssCache.get(cssUrl);
    if (cached) return cached;

    const promise = fetch(cssUrl, { credentials: 'same-origin' })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to load menu CSS (${response.status})`);
        }
        return response.text();
      })
      .then((rawCss) => this.transformCssForShadow(rawCss));

    shadowCssCache.set(cssUrl, promise);

    try {
      return await promise;
    } catch (error) {
      shadowCssCache.delete(cssUrl);
      logger.warn(
        'Failed to build shadow CSS, falling back to light DOM:',
        error,
      );
      return '';
    }
  }

  async getShadowStylesheet(cssUrl) {
    const supportsConstructable =
      typeof CSSStyleSheet !== 'undefined' &&
      'replace' in CSSStyleSheet.prototype &&
      typeof ShadowRoot !== 'undefined' &&
      'adoptedStyleSheets' in ShadowRoot.prototype;

    if (!supportsConstructable) return null;

    const cached = shadowSheetCache.get(cssUrl);
    if (cached) return cached;

    const promise = this.getShadowScopedCssText(cssUrl).then(
      async (cssText) => {
        if (!cssText) return null;
        const sheet = new CSSStyleSheet();
        await sheet.replace(cssText);
        return sheet;
      },
    );

    shadowSheetCache.set(cssUrl, promise);

    try {
      return await promise;
    } catch (error) {
      shadowSheetCache.delete(cssUrl);
      logger.warn('Failed to create constructable stylesheet:', error);
      return null;
    }
  }

  transformCssForShadow(rawCss) {
    const withHostSelector = String(rawCss || '').replace(
      /(^|\n)\s*site-menu\s*\{/g,
      '$1:host {',
    );

    const withHostContext = withHostSelector.replace(
      /(^|[,{]\s*)\.site-header\.search-mode/g,
      '$1:host-context(.site-header.search-mode)',
    );

    return withHostContext;
  }

  // Get current stats
  getStats() {
    return {
      initialized: this.initialized,
      state: {
        isOpen: this.state.isOpen,
        title: this.state.currentTitle,
        subtitle: this.state.currentSubtitle,
      },
      search: {
        isOpen: this.search?.isSearchOpen() || false,
      },
      device: this.performance.getDeviceCapabilities(),
    };
  }
}

customElements.define('site-menu', SiteMenu);
