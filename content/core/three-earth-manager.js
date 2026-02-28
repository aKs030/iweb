/**
 * Three.js Earth Manager
 * @version 1.2.0
 */

import { createLogger } from './logger.js';
import { getElementById, TimerManager, upsertHeadLink } from './utils.js';
import { AppLoadManager } from './load-manager.js';
import { threeEarthState } from '../components/particles/three-earth-state.js';

const log = createLogger('ThreeEarthManager');

export class ThreeEarthManager {
  /**
   * @param {Object} env - Environment configuration object
   */
  constructor(env) {
    this.env = env;
    this.cleanupFn = null;
    this.isLoading = false;
    this.timers = new TimerManager('ThreeEarthManager');
  }

  getContainer() {
    return (
      getElementById('threeEarthContainer') || getElementById('earth-container')
    );
  }

  async load() {
    if (this.isLoading || this.cleanupFn) return;

    if (this.env.isTest && !threeEarthState.isForceEnabled()) {
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
      this.announce('3D-Darstellung deaktiviert — Datensparmodus aktiv');
      return;
    }

    this.isLoading = true;

    // Preload critical textures immediately when earth loading starts
    this.preloadTextures();

    // Set loading timeout to prevent indefinite blocking
    const loadingTimeout = this.timers.setTimeout(() => {
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
        threeEarthState.setCleanupFunction(this.cleanupFn);
        log.info('Three.js Earth system initialized');
        this.announce('Interaktive 3D-Erde geladen');
      }
    } catch (error) {
      log.warn('Three.js failed, using CSS fallback:', error);
      this.announce('CSS-Modus aktiv — 3D-Ansicht nicht verfügbar');
      // Unblock loader even on error
      AppLoadManager.unblock('three-earth');
    } finally {
      this.timers.clearTimeout(loadingTimeout);
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

    const highPriorityTexture = texturePaths[0];
    if (highPriorityTexture) {
      upsertHeadLink({
        rel: 'preload',
        href: highPriorityTexture,
        as: 'image',
        dataset: { injectedBy: 'three-earth' },
        attrs: { fetchpriority: 'high' },
      });
    }

    this._preloadedImages = texturePaths.map((path, index) => {
      const img = new Image();
      if (index === 0) {
        img.fetchPriority = 'high';
      }
      img.src = path;
      return img;
    });
  }

  init() {
    const container = this.getContainer();
    if (!container) return;

    // Start loading immediately if container exists, don't wait for viewport
    this.load();
  }

  cleanup() {
    this.timers.clearAll();
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

  /**
   * Announce state change via ARIA live region
   * @param {string} message
   */
  announce(message) {
    try {
      if (typeof globalThis.announce === 'function') {
        globalThis.announce(message, { dedupe: true });
      }
    } catch {
      /* ignore */
    }
  }
}
