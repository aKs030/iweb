// @ts-check
/**
 * Modern Site Menu Web Component
 * Encapsulates the menu controller and its subsystems.
 * @version 1.0.0
 */

import { MenuRenderer } from './modules/MenuRenderer.js';
import { MenuState } from './modules/MenuState.js';
import { MenuEvents } from './modules/MenuEvents.js';
import { MenuAccessibility } from './modules/MenuAccessibility.js';
import { MenuPerformance } from './modules/MenuPerformance.js';
import { MenuCache } from './modules/MenuCache.js';
import { MenuConfig } from './modules/MenuConfig.js';
import { createLogger } from '/content/core/logger.js';
import menuStyles from './menu-css.js';

const logger = createLogger('SiteMenu');

export class SiteMenu extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.config = { ...MenuConfig };
    this.state = new MenuState();
    // @ts-ignore
    this.renderer = new MenuRenderer(this.state, this.config);
    this.performance = new MenuPerformance();
    this.cache = new MenuCache();
    /** @type {MenuEvents|null} */
    this.events = null;
    /** @type {MenuAccessibility|null} */
    this.accessibility = null;
    this.initialized = false;
  }

  async connectedCallback() {
    if (this.initialized) return;

    this.performance.startMeasure('menu-init');

    try {
      // Styles are now injected into Shadow DOM
      this.injectStyles();
      this.injectGlobalStyles();

      // Prevent double initialization
      if (this.dataset.initialized === 'true') {
        this.initialized = true;
        return;
      }
      this.dataset.initialized = 'true';

      // Render menu into Shadow DOM
      // @ts-ignore
      this.renderer.render(this.shadowRoot);

      // Initialize subsystems with Shadow DOM context
      // @ts-ignore
      this.accessibility = new MenuAccessibility(this.shadowRoot, this.state);
      this.events = new MenuEvents(
        this.shadowRoot,
        this.state,
        this.renderer,
        this.config,
      );

      // @ts-ignore
      this.accessibility.init();
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
    // @ts-ignore
    this.accessibility?.destroy();
    this.performance?.destroy();
    this.cache?.clear();
    this.state.reset();
    this.initialized = false;
  }

  injectStyles() {
    // eslint-disable-next-line no-undef
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(menuStyles);
    // @ts-ignore
    this.shadowRoot.adoptedStyleSheets = [sheet];
  }

  injectGlobalStyles() {
    const styleId = 'site-menu-global';
    if (document.getElementById(styleId)) return;

    const css = `
      main { margin-top: 88px; padding: 1rem; }
      @media (width <= 900px) {
        main { margin-top: 72px; }
      }
    `;
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = css;
    document.head.appendChild(style);
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
      cache: this.cache.getStats(),
      device: this.performance.getDeviceCapabilities(),
    };
  }
}

customElements.define('site-menu', SiteMenu);
