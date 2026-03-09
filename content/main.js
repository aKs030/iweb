/**
 * Main Application Entry Point
 * @version 6.3.0
 */

import { initHeroFeatureBundle } from '#pages/home/hero-manager.js';
import { createLogger } from '#core/logger.js';
import { a11y, createAnnouncer } from '#core/accessibility-manager.js';
import { SectionManager } from '#core/section-manager.js';
import { AppLoadManager, loadSignals } from '#core/load-manager.js';
import { signal, effect, computed } from '#core/signals.js';
import { ThreeEarthManager } from '#core/three-earth-manager.js';
import { onDOMReady, TimerManager } from '#core/utils.js';
import { initViewTransitions } from '#core/view-transitions.js';
import { i18n } from '#core/i18n.js';
import { GlobalEventHandlers } from '#core/events.js';
import { resourceHints } from '#core/resource-hints.js';
import { initOfflineAnalytics } from '#core/offline-analytics.js';
import {
  initNetworkStatusIndicator,
  initServiceWorkerLifecycle,
} from '#core/sw-registration.js';
import { initThemeState } from '#core/theme-state.js';

const log = createLogger('main');
const appTimers = new TimerManager('Main');

// ===== Configuration & Environment =====
const ENV = {
  isTest:
    new URLSearchParams(globalThis.location.search).has('test') ||
    navigator.userAgent.includes('HeadlessChrome') ||
    (globalThis.location.hostname === 'localhost' &&
      globalThis.navigator.webdriver),
};

// ===== Loading Configuration =====
const LOADING_CONFIG = {
  TIMEOUT_MS: 5000, // Maximale Wartezeit — danach wird Loader forciert ausgeblendet
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

// ===== Section Manager =====
const sectionManager = new SectionManager();

// ===== Initialize Managers =====
// Declared before onDOMReady so _initApp can reference it without temporal issues
const ThreeEarthLoader = new ThreeEarthManager(ENV);
const loaderHidden = signal(false);
const modulesReady = signal(false);
const windowLoaded = signal(document.readyState === 'complete');
const loadBlocked = computed(() => loadSignals.pending.value.length > 0);
const canHideLoader = computed(
  () =>
    !loaderHidden.value &&
    modulesReady.value &&
    windowLoaded.value &&
    !loadBlocked.value,
);

let _appInitialized = false;

const _initApp = () => {
  if (_appInitialized) {
    log.debug('App already initialized, skipping duplicate init');
    return;
  }
  _appInitialized = true;

  sectionManager.init();

  // Start earth loading in next frame to avoid blocking DOM ready
  requestAnimationFrame(() => {
    ThreeEarthLoader.init();
  });

  try {
    a11y?.updateAnimations?.();
    a11y?.updateContrast?.();
  } catch (error) {
    log.warn('A11y update failed:', error);
  }

  initThemeState();

  // Initialize View Transitions API (progressive enhancement)
  initViewTransitions();

  // Initialize Resource Hints & Speculative Prerendering
  resourceHints.init();
};

onDOMReady(_initApp);

// ===== Application Bootstrap =====
document.addEventListener(
  'DOMContentLoaded',
  async () => {
    await i18n.init();
    initNetworkStatusIndicator({ announce, timers: appTimers });
    perfMarks.domReady = performance.now();

    const updateLoader = (progress, message, options) => {
      if (loaderHidden.value) return;
      AppLoadManager.updateLoader(progress, message, options);
    };

    effect(() => {
      const pending = loadSignals.pending.value;

      log.debug('Loader readiness changed', {
        modulesReady: modulesReady.value,
        windowLoaded: windowLoaded.value,
        isBlocked: loadBlocked.value,
        canHideLoader: canHideLoader.value,
        done: loadSignals.done.value,
        pending,
      });

      if (!canHideLoader.value) return;

      updateLoader(1, i18n.t('loader.ready_system'));
      loaderHidden.value = true;
      appTimers.setTimeout(() => AppLoadManager.hideLoader(), 100);
      announce(i18n.t('loader.app_loaded'), { dedupe: true });
    });

    globalThis.addEventListener(
      'load',
      () => {
        perfMarks.windowLoaded = performance.now();
        windowLoaded.value = true;
        updateLoader(0.7, i18n.t('loader.resources'));
      },
      { once: true },
    );

    updateLoader(0.2, i18n.t('loader.modules_core'));
    updateLoader(0.3, i18n.t('loader.hero_init'));
    initHeroFeatureBundle(sectionManager);

    updateLoader(0.4, i18n.t('loader.system_3d'));
    updateLoader(0.5, i18n.t('loader.optimize_images'));

    modulesReady.value = true;
    perfMarks.modulesReady = performance.now();
    updateLoader(0.6, i18n.t('loader.modules_loaded'));

    // Force hide after timeout
    appTimers.setTimeout(() => {
      if (!loaderHidden.value) {
        log.info('Forcing loading screen hide after timeout');
        updateLoader(1, i18n.t('loader.timeout'));
        loaderHidden.value = true;
        AppLoadManager.hideLoader();
      }
    }, LOADING_CONFIG.TIMEOUT_MS);

    // Initialize global event handlers
    GlobalEventHandlers.init(announce);

    // Initialize offline-first analytics pipeline (IndexedDB + Background Sync)
    initOfflineAnalytics();

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

    // Trigger visibility change to resume animations
    if (!document.hidden) {
      document.dispatchEvent(new CustomEvent('visibilitychange'));
    }
  }
});

initServiceWorkerLifecycle({ isTest: ENV.isTest, announce });
