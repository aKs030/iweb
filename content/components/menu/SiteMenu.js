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

  async ensureStyles() {
    if (typeof document === 'undefined') return;

    const cssUrl = this.config.CSS_URL || '/content/components/menu/menu.css';
    if (this.usesShadowDOM && this.shadowRoot) {
      const sheet = await this.getShadowStylesheet(cssUrl);

      if (sheet && 'adoptedStyleSheets' in this.shadowRoot) {
        if (!this.shadowRoot.adoptedStyleSheets.includes(sheet)) {
          this.shadowRoot.adoptedStyleSheets = [
            ...this.shadowRoot.adoptedStyleSheets,
            sheet,
          ];
        }
        return;
      }

      const cssText = await this.getShadowScopedCssText(cssUrl);
      if (!cssText) return;

      if (!this.shadowStyleElement) {
        this.shadowStyleElement = document.createElement('style');
        this.shadowStyleElement.dataset.injectedBy = 'site-menu-shadow';
        this.shadowRoot.appendChild(this.shadowStyleElement);
      }

      this.shadowStyleElement.textContent = cssText;
      return;
    }

    const existing = document.head.querySelector(`link[href="${cssUrl}"]`);
    if (existing) return;

    upsertHeadLink({
      rel: 'stylesheet',
      href: cssUrl,
      attrs: { media: 'all' },
      dataset: { injectedBy: 'site-menu' },
    });
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

    return `:host { display: contents; }\n${withHostContext}`;
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
