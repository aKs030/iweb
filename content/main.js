/**
 * Main Application Entry Point
 * @version 5.0.0
 * @last-modified 2026-01-25
 */

import { initHeroFeatureBundle } from '../pages/home/hero-manager.js';
import {
  createLogger,
  EVENTS,
  fire,
  schedulePersistentStorageRequest,
  AppLoadManager,
  SectionTracker,
} from '/content/core/shared-utilities.js';
import { a11y, createAnnouncer } from './core/accessibility-manager.js';
import { getThreeEarthContainer, getSnapContainer } from './core/dom-cache.js';
import { SectionManager } from './core/section-manager.js';
import { LoaderManager } from './core/loader-manager.js';
import { ThreeEarthManager } from './core/three-earth-manager.js';
import { EventDelegator } from './core/event-delegator.js';
import { StyleActivator } from './core/style-activator.js';
import { ScrollManager } from './core/scroll-manager.js';
import './components/menu/menu.js';

const log = createLogger('main');

// Debug hooks for testing
globalThis.__threeEarthCleanup = null;

// ===== Configuration & Environment =====
const ENV = {
  isTest:
    new URLSearchParams(globalThis.location.search).has('test') ||
    navigator.userAgent.includes('HeadlessChrome') ||
    (globalThis.location.hostname === 'localhost' &&
      globalThis.navigator.webdriver),
  debug: new URLSearchParams(globalThis.location.search).has('debug'),
};

// ===== Performance Tracking =====
const perfMarks = {
  start: performance.now(),
  domReady: 0,
  modulesReady: 0,
  windowLoaded: 0,
};

// ===== Accessibility Announcements =====
const announce = createAnnouncer();
globalThis.announce = announce;

// ===== Section Tracker =====
const sectionTracker = new SectionTracker();
sectionTracker.init();

// ===== Section Manager =====
const sectionManager = new SectionManager();

// Expose as global for backward compatibility
globalThis.SectionLoader = {
  init: () => sectionManager.init(),
  reinit: () => sectionManager.reinit(),
  loadSection: (section) => sectionManager.loadSection(section),
  retrySection: (section) => sectionManager.retrySection(section),
};

function _initApp() {
  sectionManager.init();
  try {
    a11y?.updateAnimations?.();
    a11y?.updateContrast?.();
  } catch {
    // Ignore
  }
}

if (document.readyState !== 'loading') {
  _initApp();
} else {
  document.addEventListener(EVENTS.DOM_READY, _initApp, { once: true });
}

// ===== Initialize Managers =====
const scrollManager = new ScrollManager();
scrollManager.init(getSnapContainer());

const LoadingScreenManager = new LoaderManager();
const ThreeEarthLoader = new ThreeEarthManager(ENV);
const eventDelegator = new EventDelegator();
const styleActivator = new StyleActivator();

// ===== Application Bootstrap =====
document.addEventListener(
  'DOMContentLoaded',
  async () => {
    perfMarks.domReady = performance.now();
    LoadingScreenManager.init();

    fire(EVENTS.DOM_READY);

    let modulesReady = false;
    let windowLoaded = false;

    const checkReady = () => {
      if (!modulesReady || !windowLoaded) return;
      const blocked =
        typeof AppLoadManager !== 'undefined' &&
        typeof AppLoadManager.isBlocked === 'function' &&
        AppLoadManager.isBlocked();
      if (blocked) return;

      // Ensure Three.js Earth signaled readiness if present
      const earthContainer = getThreeEarthContainer();
      const earthReady = earthContainer?.dataset?.threeReady === '1';
      if (earthContainer && !earthReady) {
        return;
      }

      LoadingScreenManager.setStatus('Starte Experience...', 98);
      LoadingScreenManager.hide({ debug: ENV.debug });
      announce('Anwendung geladen', { dedupe: true });
    };

    document.addEventListener(EVENTS.LOADING_UNBLOCKED, checkReady);

    globalThis.addEventListener(
      'load',
      () => {
        perfMarks.windowLoaded = performance.now();
        windowLoaded = true;
        LoadingScreenManager.setStatus('Finalisiere Assets...', 92);
        checkReady();
      },
      { once: true },
    );

    fire(EVENTS.CORE_INITIALIZED);
    fire(EVENTS.HERO_INIT_READY);
    initHeroFeatureBundle();

    ThreeEarthLoader.initDelayed();

    modulesReady = true;
    perfMarks.modulesReady = performance.now();
    LoadingScreenManager.setStatus('Initialisiere 3D-Engine...', 90);
    fire(EVENTS.MODULES_READY);
    checkReady();

    // Smart force-hide with retry logic
    (function scheduleSmartForceHide(attempt = 1) {
      const DEFAULT_DELAY = 4000;
      const EXTENDED_DELAY = 6000;
      const RETRY_DELAY = 3000;
      const MAX_ATTEMPTS = 3;

      const computeDelay = () => {
        try {
          if (typeof AppLoadManager?.getPending === 'function') {
            const pending = AppLoadManager.getPending() || [];
            if (pending.includes('three-earth')) return EXTENDED_DELAY;
          }
        } catch {
          // Fallback to default
        }
        return DEFAULT_DELAY;
      };

      const initialDelay = computeDelay();

      setTimeout(
        () => {
          if (windowLoaded) return;

          try {
            if (
              typeof AppLoadManager?.isBlocked === 'function' &&
              AppLoadManager.isBlocked()
            ) {
              const pending = AppLoadManager.getPending?.() || [];
              log.warn(
                `Deferring forced hide (attempt ${attempt}): blocking modules=${pending.join(', ')}`,
              );

              if (attempt < MAX_ATTEMPTS) {
                scheduleSmartForceHide(attempt + 1);
                return;
              }
              log.warn('Max attempts reached - forcing hide');
            }
          } catch (e) {
            log.debug('AppLoadManager check failed', e);
          }

          const pending = AppLoadManager?.getPending?.() || [];
          log.info(
            'Forcing loading screen hide after timeout',
            pending.length ? { pendingModules: pending } : undefined,
          );
          LoadingScreenManager.setStatus('Schließe Ladebildschirm...');
          LoadingScreenManager.hide({ debug: ENV.debug });
        },
        attempt === 1 ? initialDelay : RETRY_DELAY,
      );
    })();

    schedulePersistentStorageRequest(2200);

    // Initialize style activator and event delegator
    styleActivator.init();
    eventDelegator.init(announce);

    log.info('Performance:', {
      domReady: Math.round(perfMarks.domReady - perfMarks.start),
      modulesReady: Math.round(perfMarks.modulesReady - perfMarks.start),
      windowLoaded: Math.round(perfMarks.windowLoaded - perfMarks.start),
    });
  },
  { once: true },
);

// ===== BFCache / Back Button Handling =====
globalThis.addEventListener('pageshow', (event) => {
  if (event.persisted) {
    log.info('Page restored from bfcache');
    globalThis.dispatchEvent(new CustomEvent('resize'));

    if (
      !document.hidden &&
      globalThis.threeEarthSystem &&
      globalThis.threeEarthSystem.animate
    ) {
      document.dispatchEvent(new CustomEvent('visibilitychange'));
    }
  }
});
