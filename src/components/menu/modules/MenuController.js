/**
 * Menu Controller - Orchestrates menu components
 */

import { MenuRenderer } from './MenuRenderer.js';
import { MenuState } from './MenuState.js';
import { MenuEvents } from './MenuEvents.js';
import { MenuAccessibility } from './MenuAccessibility.js';
import { MenuPerformance } from './MenuPerformance.js';
import { MenuCache } from './MenuCache.js';
import { MenuConfig } from './MenuConfig.js';
import { getElementById } from '/core/dom-utils.js';
import { upsertHeadLink } from '/core/dom-utils.js';
import { createLogger } from '/core/logger.js';

export class MenuController {
  constructor(config = {}) {
    this.config = { ...MenuConfig, ...config };
    this.log = createLogger('Menu', {
      level: this.config.ENABLE_DEBUG ? 3 : undefined, // 3 = debug
    });
    this.state = new MenuState();
    this.renderer = new MenuRenderer(this.state, this.config);
    this.performance = new MenuPerformance();
    this.cache = new MenuCache();
    this.events = null;
    this.accessibility = null;
    this.container = null;
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;

    this.performance.startMeasure('menu-init');

    try {
      // Ensure styles are loaded
      this.ensureStyles();

      // Get or wait for container
      this.container = this.explicitContainer || await this.getContainer();
      if (!this.container) {
        throw new Error('Menu container not found');
      }

      // Prevent double initialization
      if (this.container.dataset.initialized === 'true') {
        this.initialized = true;
        return;
      }
      this.container.dataset.initialized = 'true';

      // Cache container
      this.cache.setElement('container', this.container);

      // Render menu
      this.renderer.render(this.container);

      // Initialize subsystems
      this.accessibility = new MenuAccessibility(this.container, this.state);
      this.events = new MenuEvents(
        this.container,
        this.state,
        this.renderer,
        this.config,
      );

      this.accessibility.init();
      this.events.init();

      this.initialized = true;

      const duration = this.performance.endMeasure('menu-init');
      this.log.debug(`Initialized in ${duration.toFixed(2)}ms`);
    } catch (error) {
      this.log.error('Initialization failed:', error);
      throw error;
    }
  }

  ensureStyles() {
    if (typeof document === 'undefined') return;

    const cssUrl = this.config.CSS_URL;
    const existing = document.head.querySelector(`link[href="${cssUrl}"]`);
    if (existing) return;

    upsertHeadLink({
      rel: 'stylesheet',
      href: cssUrl,
      attrs: { media: 'all' },
      dataset: { injectedBy: 'menu-js' },
    });
  }

  async getContainer() {
    let container = getElementById('menu-container');
    if (container) return container;

    // Wait for container with timeout
    return new Promise((resolve) => {
      const observer = new MutationObserver(() => {
        container = getElementById('menu-container');
        if (container) {
          observer.disconnect();
          resolve(container);
        }
      });

      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => {
        observer.disconnect();
        resolve(null);
      }, 3000);
    });
  }

  destroy() {
    this.events?.destroy();
    this.accessibility?.destroy();
    this.performance?.destroy();
    this.cache?.clear();
    this.state.reset();
    this.initialized = false;

    this.log.debug('Destroyed');
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
