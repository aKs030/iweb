/**
 * Three.js Earth Manager
 * @version 1.1.0
 */

import { createLogger } from './logger.js';
import { getElementById } from './utils.js';
import { AppLoadManager } from './load-manager.js';

const log = createLogger('ThreeEarthManager');

export class ThreeEarthManager {
  /**
   * @param {Object} env - Environment configuration object
   */
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

    // @ts-ignore - connection is not in standard Navigator type but exists in some browsers
    if (navigator.connection?.saveData) {
      log.info('Three.js skipped: save-data mode');
      return;
    }

    this.isLoading = true;

    // Preload critical textures immediately when earth loading starts
    this.preloadTextures();

    // Set loading timeout to prevent indefinite blocking
    const loadingTimeout = setTimeout(() => {
      log.warn('Three.js Earth loading timeout, unblocking loader');
      AppLoadManager.unblock('three-earth');
    }, 6000); // 6 second timeout for earth loading

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
        clearTimeout(loadingTimeout); // Clear timeout on success
      }
    } catch (error) {
      log.warn('Three.js failed, using CSS fallback:', error);
      clearTimeout(loadingTimeout);
      // Unblock loader even on error
      AppLoadManager.unblock('three-earth');
    } finally {
      this.isLoading = false;
    }
  }

  preloadTextures() {
    // Preload critical earth textures programmatically
    const texturePaths = [
      '/content/assets/img/earth/textures/earth_day.webp',
      '/content/assets/img/earth/textures/earth_night.webp',
      '/content/assets/img/earth/textures/earth_normal.webp',
      '/content/assets/img/earth/textures/earth_bump.webp',
    ];

    texturePaths.forEach((path) => {
      const img = new Image();
      img.src = path;
      // Don't wait for loading, just start the download
    });
  }

  init() {
    const container = this.getContainer();
    if (!container) return;

    // Start loading immediately if container exists, don't wait for viewport
    this.load();
  }

  initDelayed() {
    const idleCallback = globalThis.requestIdleCallback || setTimeout;
    idleCallback(() => this.init(), { timeout: 500 }); // Reduced from 2000ms to 500ms
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
