/**
 * Three.js Earth Manager
 * @version 1.1.0
 */

import { createLogger } from './logger.js';
import { getElementById } from './dom-utils.js';
import { observeOnce } from './intersection-observer.js';

const log = createLogger('ThreeEarthManager');

export class ThreeEarthManager {
  constructor(env) {
    this.env = env;
    this.cleanupFn = null;
    this.isLoading = false;
  }

  getContainer() {
    return (
      getElementById('threeEarthContainer') || getElementById('earth-container')
    );
  }

  async load() {
    if (this.isLoading || this.cleanupFn) return;

    if (this.env.isTest && !globalThis.__FORCE_THREE_EARTH) {
      log.info('Test environment - skipping Three.js Earth');
      return;
    }

    const container = this.getContainer();
    if (!container) {
      log.debug('Earth container not found');
      return;
    }

    if (navigator.connection?.saveData) {
      log.info('Three.js skipped: save-data mode');
      return;
    }

    this.isLoading = true;

    try {
      log.info('Loading Three.js Earth system...');
      const { initThreeEarth } =
        await import('../components/particles/three-earth-system.js');

      if (typeof initThreeEarth !== 'function') {
        throw new Error('initThreeEarth not found in module exports');
      }

      this.cleanupFn = await initThreeEarth();

      if (typeof this.cleanupFn === 'function') {
        globalThis.__threeEarthCleanup = this.cleanupFn;
        log.info('Three.js Earth system initialized');
      }
    } catch (error) {
      log.warn('Three.js failed, using CSS fallback:', error);
    } finally {
      this.isLoading = false;
    }
  }

  init() {
    const container = this.getContainer();
    if (!container) return;

    try {
      const rect = container.getBoundingClientRect();
      const withinMargin =
        rect.top < (globalThis.innerHeight || 0) + 100 && rect.bottom > -100;
      const loaderVisible =
        getElementById('app-loader')?.dataset?.loaderDone !== 'true';

      if (withinMargin || loaderVisible) {
        this.load();
        return;
      }
    } catch {
      // Fallback to observer
    }

    observeOnce(container, () => this.load(), {
      rootMargin: '400px',
      threshold: 0.01,
    });
  }

  initDelayed() {
    const idleCallback = globalThis.requestIdleCallback || setTimeout;
    idleCallback(() => this.init(), { timeout: 2000 });
  }

  cleanup() {
    if (this.cleanupFn) {
      try {
        this.cleanupFn();
        this.cleanupFn = null;
        log.info('Three.js Earth cleaned up');
      } catch (error) {
        log.warn('Cleanup failed:', error);
      }
    }
  }
}
