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
import { upsertHeadLink } from '/content/core/dom-utils.js';
import { createLogger } from '/content/core/logger.js';

const logger = createLogger('SiteMenu');

export class SiteMenu extends HTMLElement {
  constructor() {
    super();
    this.config = { ...MenuConfig };
    this.state = new MenuState();
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
      this.ensureStyles();

      // Prevent double initialization
      if (this.dataset.initialized === 'true') {
        this.initialized = true;
        return;
      }
      this.dataset.initialized = 'true';

      // Render menu
      this.renderer.render(this);

      // Initialize subsystems
      this.accessibility = new MenuAccessibility(this, this.state);
      this.events = new MenuEvents(
        this,
        this.state,
        this.renderer,
        this.config,
      );

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
    this.accessibility?.destroy();
    this.performance?.destroy();
    this.cache?.clear();
    this.state.reset();
    this.initialized = false;
  }

  ensureStyles() {
    if (typeof document === 'undefined') return;

    const cssUrl = this.config.CSS_URL || '/content/components/menu/menu.css';
    const existing = document.head.querySelector(`link[href="${cssUrl}"]`);
    if (existing) return;

    upsertHeadLink({
      rel: 'stylesheet',
      href: cssUrl,
      attrs: { media: 'all' },
      dataset: { injectedBy: 'site-menu' },
    });
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
