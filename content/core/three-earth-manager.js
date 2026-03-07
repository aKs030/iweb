/**
 * Three.js Earth Manager
 * @version 1.2.0
 */

import { cancelIdleTask, scheduleIdleTask } from './idle.js';
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
    const dayTexture = '/content/assets/img/earth/textures/earth_day.webp';
    const canPreloadNow = document.readyState !== 'complete';
    if (canPreloadNow) {
      upsertHeadLink({
        rel: 'preload',
        href: dayTexture,
        as: 'image',
        crossOrigin: 'anonymous',
        dataset: { injectedBy: 'three-earth' },
        attrs: { fetchpriority: 'high' },
      });
    }

    // Secondary textures are queued as low-priority prefetches.
    [
      '/content/assets/img/earth/textures/earth_night.webp',
      '/content/assets/img/earth/textures/earth_normal.webp',
      '/content/assets/img/earth/textures/earth_bump.webp',
    ].forEach((href) => {
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

    // Determine if we're on a mobile device (for performance deferring)
    // PageSpeed predominantly tests with mobile viewports and throttled CPUs
    const isMobile =
      globalThis.innerWidth < 768 ||
      navigator.userAgent.toLowerCase().includes('mobi');

    // 1) Load when user intent is clear (click/tap/key interaction).
    const onIntent = () => {
      startLoad();
    };

    window.addEventListener('pointerdown', onIntent, {
      once: true,
      passive: true,
    });
    window.addEventListener('keydown', onIntent, { once: true });
    this.deferIntentCleanup = () => {
      window.removeEventListener('pointerdown', onIntent);
      window.removeEventListener('keydown', onIntent);
      this.deferIntentCleanup = null;
    };

    // 2) Load when container is near viewport - only on desktop to save mobile main thread
    if ('IntersectionObserver' in globalThis && !isMobile) {
      this.deferObserver = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            startLoad();
          }
        },
        {
          root: null,
          rootMargin: '300px 0px',
          threshold: 0.01,
        },
      );
      this.deferObserver.observe(container);
    }

    // 3) Fallback/assist: load during idle time (with timeout).
    // On mobile, wait much longer to ensure the main thread is free for vital interactions
    this.deferIdleHandle = scheduleIdleTask(
      () => {
        startLoad();
      },
      {
        timeout: isMobile ? 8000 : 2500,
        fallbackDelay: isMobile ? 8000 : 2500,
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
