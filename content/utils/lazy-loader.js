/**
 * Lazy Loading Utilities
 * Optimized lazy loading for images, components, and modules
 */

import { createLogger } from './shared-utilities.js';

const log = createLogger('lazy-loader');

/**
 * Enhanced image lazy loading with WebP support and blur-up effect
 */
export class LazyImageLoader {
  constructor(options = {}) {
    this.options = {
      rootMargin: '50px 0px',
      threshold: 0.01,
      enableWebP: true,
      enableBlurUp: true,
      ...options,
    };

    this.observer = null;
    this.init();
  }

  init() {
    if (!('IntersectionObserver' in window)) {
      // Fallback for older browsers
      this.loadAllImages();
      return;
    }

    this.observer = new IntersectionObserver(
      this.handleIntersection.bind(this),
      {
        rootMargin: this.options.rootMargin,
        threshold: this.options.threshold,
      },
    );

    // Observe all lazy images
    this.observeImages();
  }

  observeImages() {
    const images = document.querySelectorAll(
      'img[data-src], img[loading="lazy"]',
    );
    images.forEach((img) => this.observer.observe(img));
  }

  handleIntersection(entries) {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        this.loadImage(entry.target);
        this.observer.unobserve(entry.target);
      }
    });
  }

  async loadImage(img) {
    const src = img.dataset.src || img.src;
    if (!src) return;

    try {
      // Check for WebP support and use WebP version if available
      const optimizedSrc = this.options.enableWebP
        ? await this.getOptimizedImageSrc(src)
        : src;

      // Preload the image
      const imageLoader = new Image();
      imageLoader.onload = () => {
        img.src = optimizedSrc;
        img.classList.add('loaded');

        // Remove blur-up placeholder
        if (this.options.enableBlurUp) {
          img.style.filter = 'none';
        }
      };

      imageLoader.onerror = () => {
        // Fallback to original src on error
        img.src = src;
        img.classList.add('error');
      };

      imageLoader.src = optimizedSrc;
    } catch (error) {
      log.warn('Image loading failed:', error);
      img.src = src;
    }
  }

  async getOptimizedImageSrc(src) {
    // Check if WebP is supported
    if (!this.supportsWebP()) return src;

    // Convert image URLs to WebP if possible
    if (src.includes('unsplash.com')) {
      return src + '&fm=webp&q=80';
    }

    // Add more CDN optimizations as needed
    return src;
  }

  supportsWebP() {
    if (this._webpSupport !== undefined) return this._webpSupport;

    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    this._webpSupport =
      canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
    return this._webpSupport;
  }

  loadAllImages() {
    // Fallback for browsers without IntersectionObserver
    const images = document.querySelectorAll('img[data-src]');
    images.forEach((img) => {
      img.src = img.dataset.src;
      img.classList.add('loaded');
    });
  }

  destroy() {
    if (this.observer) {
      this.observer.disconnect();
    }
  }
}

/**
 * Dynamic module loader with caching
 */
export class ModuleLoader {
  constructor() {
    this.cache = new Map();
    this.loading = new Map();
  }

  async loadModule(modulePath) {
    // Return cached module if available
    if (this.cache.has(modulePath)) {
      return this.cache.get(modulePath);
    }

    // Return existing promise if already loading
    if (this.loading.has(modulePath)) {
      return this.loading.get(modulePath);
    }

    // Start loading the module
    const loadPromise = this.doLoadModule(modulePath);
    this.loading.set(modulePath, loadPromise);

    try {
      const module = await loadPromise;
      this.cache.set(modulePath, module);
      this.loading.delete(modulePath);
      return module;
    } catch (error) {
      this.loading.delete(modulePath);
      throw error;
    }
  }

  async doLoadModule(modulePath) {
    try {
      const module = await import(modulePath);
      log.info(`Module loaded: ${modulePath}`);
      return module;
    } catch (error) {
      log.error(`Failed to load module: ${modulePath}`, error);
      throw error;
    }
  }

  preloadModule(modulePath) {
    // Preload without waiting
    this.loadModule(modulePath).catch(() => {
      // Ignore preload errors
    });
  }

  clearCache() {
    this.cache.clear();
    this.loading.clear();
  }
}

/**
 * Component lazy loader with intersection observer
 */
export class LazyComponentLoader {
  constructor() {
    this.moduleLoader = new ModuleLoader();
    this.observer = null;
    this.init();
  }

  init() {
    if (!('IntersectionObserver' in window)) return;

    this.observer = new IntersectionObserver(
      this.handleIntersection.bind(this),
      {
        rootMargin: '100px 0px',
        threshold: 0.01,
      },
    );

    // Observe all lazy components
    this.observeComponents();
  }

  observeComponents() {
    const components = document.querySelectorAll('[data-lazy-component]');
    components.forEach((element) => this.observer.observe(element));
  }

  async handleIntersection(entries) {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        await this.loadComponent(entry.target);
        this.observer.unobserve(entry.target);
      }
    }
  }

  async loadComponent(element) {
    const componentPath = element.dataset.lazyComponent;
    if (!componentPath) return;

    try {
      element.classList.add('loading');

      const module = await this.moduleLoader.loadModule(componentPath);

      // Initialize the component
      if (module.default && typeof module.default === 'function') {
        await module.default(element);
      } else if (module.init && typeof module.init === 'function') {
        await module.init(element);
      }

      element.classList.remove('loading');
      element.classList.add('loaded');
    } catch (error) {
      log.error(`Failed to load component: ${componentPath}`, error);
      element.classList.remove('loading');
      element.classList.add('error');
    }
  }

  destroy() {
    if (this.observer) {
      this.observer.disconnect();
    }
  }
}

// Global instances
export const lazyImageLoader = new LazyImageLoader();
export const moduleLoader = new ModuleLoader();
export const lazyComponentLoader = new LazyComponentLoader();

// Auto-initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    lazyImageLoader.observeImages();
    lazyComponentLoader.observeComponents();
  });
} else {
  lazyImageLoader.observeImages();
  lazyComponentLoader.observeComponents();
}
