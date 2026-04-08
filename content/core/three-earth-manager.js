/**
 * Three.js Earth Manager
 * @version 1.2.0
 */

import { cancelIdleTask, scheduleIdleTask } from './async-utils.js';
import { getElementById, upsertHeadLink } from './dom-utils.js';
import { createLogger } from './logger.js';
import { AppLoadManager } from './load-manager.js';
import { TimerManager } from './timer-manager.js';
import { threeEarthState } from '../components/particles/three-earth-state.js';
import {
  EARTH_CRITICAL_TEXTURE_URL,
  EARTH_SECONDARY_TEXTURE_URLS,
} from '../components/particles/earth/texture-paths.js';

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
    this.deferObserver = null;
    this.deferIdleHandle = null;
    this.deferIntentCleanup = null;
  }

  getContainer() {
    return (
      getElementById('threeEarthContainer') || getElementById('earth-container')
    );
  }

  async load() {
    if (this.isLoading || this.cleanupFn) return;
    this.clearDeferredLoadHooks();

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
    AppLoadManager.block('three-earth');

    // Preload critical textures immediately when earth loading starts
    this.preloadTextures();

    // Set loading timeout to prevent indefinite readiness gating
    const loadingTimeout = this.timers.setTimeout(() => {
      log.warn('Three.js Earth loading timeout, clearing readiness block');
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
    // Avoid late-preload console warnings: only preload before window load fires.
    // Three.js image loading uses anonymous CORS, so match that on the hint.
    const canPreloadNow = document.readyState !== 'complete';
    if (canPreloadNow) {
      upsertHeadLink({
        rel: 'preload',
        href: EARTH_CRITICAL_TEXTURE_URL,
        as: 'image',
        crossOrigin: 'anonymous',
        dataset: { injectedBy: 'three-earth' },
        attrs: { fetchpriority: 'high' },
      });
    }

    // Secondary textures are queued as low-priority prefetches.
    EARTH_SECONDARY_TEXTURE_URLS.forEach((href) => {
      upsertHeadLink({
        rel: 'prefetch',
        href,
        as: 'image',
        dataset: { injectedBy: 'three-earth' },
      });
    });
  }

  init() {
    const container = this.getContainer();
    if (!container) return;
    if (this.isLoading || this.cleanupFn) return;

    const startLoad = () => {
      this.load();
    };

    // Load immediately using a short idle task to prioritize the main thread for initial render
    this.deferIdleHandle = scheduleIdleTask(
      () => {
        startLoad();
      },
      {
        timeout: 100,
        fallbackDelay: 100,
        setTimeoutFn: this.timers.setTimeout.bind(this.timers),
        clearTimeoutFn: this.timers.clearTimeout.bind(this.timers),
      },
    );
  }

  clearDeferredLoadHooks() {
    if (this.deferObserver) {
      this.deferObserver.disconnect();
      this.deferObserver = null;
    }

    cancelIdleTask(this.deferIdleHandle);
    this.deferIdleHandle = null;

    if (this.deferIntentCleanup) {
      this.deferIntentCleanup();
    }
  }

  async cleanup() {
    this.timers.clearAll();
    this.clearDeferredLoadHooks();
    if (this.cleanupFn) {
      try {
        this.cleanupFn();
        this.cleanupFn = null;
        log.info('Three.js Earth cleaned up');
      } catch (error) {
        log.warn('Cleanup failed:', error);
      }
    }

    // Release Draco/Meshopt decoder resources if model-loader was used
    try {
      const { disposeModelLoader } = await import('./model-loader.js');
      disposeModelLoader();
    } catch {
      // model-loader was never loaded — nothing to dispose
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
