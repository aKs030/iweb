/**
 * Central Component Loader - Standardized Initialization
 * Replaces various initialization patterns across components
 */

import { createLogger } from './shared-utilities.js';

const log = createLogger('ComponentLoader');

class ComponentLoader {
  constructor() {
    this.components = new Map();
    this.observers = new Map();
    this.initialized = false;
  }

  /**
   * Register a component for automatic loading
   * @param {string} selector - CSS selector to watch for
   * @param {Function} initFn - Function to call when element is found
   * @param {Object} options - Configuration options
   */
  register(selector, initFn, options = {}) {
    const config = {
      selector,
      initFn,
      runOnce: options.runOnce ?? true,
      immediate: options.immediate ?? true,
      ...options,
    };

    this.components.set(selector, config);
    log.debug(`Registered component: ${selector}`);

    // If already initialized, start watching immediately
    if (this.initialized) {
      this._watchComponent(config);
    }

    return this;
  }

  /**
   * Initialize the component loader
   */
  init() {
    if (this.initialized) return;

    // Start watching all registered components
    this.components.forEach((config) => {
      this._watchComponent(config);
    });

    this.initialized = true;
    log.info('ComponentLoader initialized');
  }

  /**
   * Watch for a specific component
   * @private
   */
  _watchComponent(config) {
    const { selector, immediate } = config;

    // Check if element already exists
    if (immediate) {
      const existingElements = document.querySelectorAll(selector);
      existingElements.forEach((element) => {
        this._initializeElement(element, config);
      });
    }

    // Set up MutationObserver for dynamic elements
    if (!this.observers.has(selector)) {
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === 1) {
              // Element node
              // Check if the node itself matches
              if (node.matches && node.matches(selector)) {
                this._initializeElement(node, config);
              }

              // Check for matching children
              const matchingChildren = node.querySelectorAll
                ? node.querySelectorAll(selector)
                : [];
              matchingChildren.forEach((child) => {
                this._initializeElement(child, config);
              });
            }
          });
        });
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });

      this.observers.set(selector, observer);
    }
  }

  /**
   * Initialize a specific element
   * @private
   */
  _initializeElement(element, config) {
    const { initFn, runOnce, selector } = config;
    const dataAttr = `data-component-${selector.replace(/[^a-zA-Z0-9]/g, '-')}`;

    // Skip if already initialized and runOnce is true
    if (runOnce && element.hasAttribute(dataAttr)) {
      return;
    }

    try {
      // Mark as initialized
      if (runOnce) {
        element.setAttribute(dataAttr, 'true');
      }

      // Call the initialization function
      initFn(element);

      log.debug(`Initialized component: ${selector}`);
    } catch (error) {
      log.warn(`Failed to initialize component ${selector}:`, error);
    }
  }

  /**
   * Unregister a component
   */
  unregister(selector) {
    this.components.delete(selector);

    const observer = this.observers.get(selector);
    if (observer) {
      observer.disconnect();
      this.observers.delete(selector);
    }

    log.debug(`Unregistered component: ${selector}`);
  }

  /**
   * Clean up all observers
   */
  destroy() {
    this.observers.forEach((observer) => observer.disconnect());
    this.observers.clear();
    this.components.clear();
    this.initialized = false;
    log.info('ComponentLoader destroyed');
  }
}

// Create singleton instance
const componentLoader = new ComponentLoader();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => componentLoader.init());
} else {
  componentLoader.init();
}

export { componentLoader, ComponentLoader };
