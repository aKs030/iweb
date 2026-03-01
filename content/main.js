/**
 * Main Application Entry Point
 * @version 6.3.0
 */

import { initHeroFeatureBundle } from '../pages/home/hero-manager.js';
import { createLogger } from './core/logger.js';
import { EVENTS, fire } from './core/events.js';
import { a11y, createAnnouncer } from './core/accessibility-manager.js';
import { SectionManager } from './core/section-manager.js';
import { AppLoadManager } from './core/load-manager.js';
import { ThreeEarthManager } from './core/three-earth-manager.js';
import {
  getElementById,
  onDOMReady,
  TimerManager,
  scrollTopIfNoHash,
  initDOMPurify,
} from './core/utils.js';
import { initViewTransitions } from './core/view-transitions.js';
import { i18n } from './core/i18n.js';
import { GlobalEventHandlers } from './core/events.js';
import { resourceHints } from './core/resource-hints.js';
import { initOfflineAnalytics } from './core/offline-analytics.js';

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
  EARTH_INIT_DELAY: 500,
  MODULE_READY_DELAY: 300,
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
let networkIndicatorDismissTimer = null;

// ===== Section Manager =====
const sectionManager = new SectionManager();

// ===== Initialize Managers =====
// Declared before onDOMReady so _initApp can reference it without temporal issues
const ThreeEarthLoader = new ThreeEarthManager(ENV);

let _appInitialized = false;

const _initApp = () => {
  if (_appInitialized) {
    log.debug('App already initialized, skipping duplicate init');
    return;
  }
  _appInitialized = true;

  // Ensure consistent scroll behaviour across browsers
  scrollTopIfNoHash();

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

  // Initialize View Transitions API (progressive enhancement)
  initViewTransitions();

  // Initialize Resource Hints & Speculative Prerendering
  resourceHints.init();
};

onDOMReady(_initApp);

// Track if loader has been hidden
let loaderHidden = false;

// ===== Application Bootstrap =====
document.addEventListener(
  'DOMContentLoaded',
  async () => {
    await Promise.all([i18n.init(), initDOMPurify()]);
    initOfflineIndicator();
    perfMarks.domReady = performance.now();
    AppLoadManager.updateLoader(0.1, i18n.t('loader.status_init'));

    fire(EVENTS.DOM_READY);

    let modulesReady = false;
    let windowLoaded = false;

    const isEarthReady = () => {
      const earthContainer =
        getElementById('threeEarthContainer') ||
        getElementById('earth-container');
      return !earthContainer || earthContainer?.dataset?.threeReady === '1';
    };

    const checkReady = () => {
      // Prevent multiple executions
      if (loaderHidden) return;

      log.debug('checkReady called', {
        modulesReady,
        windowLoaded,
        isBlocked: AppLoadManager?.isBlocked?.(),
        isEarthReady: isEarthReady(),
        pending: AppLoadManager?.getPending?.(),
      });

      if (!modulesReady || !windowLoaded) return;
      if (AppLoadManager?.isBlocked?.()) return;
      if (!isEarthReady()) return;

      loaderHidden = true;
      AppLoadManager.updateLoader(1, i18n.t('loader.ready_system'));
      appTimers.setTimeout(() => AppLoadManager.hideLoader(), 100);
      announce(i18n.t('loader.app_loaded'), { dedupe: true });
    };

    document.addEventListener(EVENTS.LOADING_UNBLOCKED, checkReady);

    globalThis.addEventListener(
      'load',
      () => {
        perfMarks.windowLoaded = performance.now();
        windowLoaded = true;
        AppLoadManager.updateLoader(0.7, i18n.t('loader.resources'));
        checkReady();
      },
      { once: true },
    );

    AppLoadManager.updateLoader(0.2, i18n.t('loader.modules_core'));
    fire(EVENTS.CORE_INITIALIZED);
    fire(EVENTS.HERO_INIT_READY);

    AppLoadManager.updateLoader(0.3, i18n.t('loader.hero_init'));
    initHeroFeatureBundle(sectionManager);

    AppLoadManager.updateLoader(0.4, i18n.t('loader.system_3d'));
    AppLoadManager.updateLoader(0.5, i18n.t('loader.optimize_images'));

    modulesReady = true;
    perfMarks.modulesReady = performance.now();
    AppLoadManager.updateLoader(0.6, i18n.t('loader.modules_loaded'));
    fire(EVENTS.MODULES_READY);
    checkReady();

    // Force hide after timeout
    appTimers.setTimeout(() => {
      if (!loaderHidden) {
        log.info('Forcing loading screen hide after timeout');
        loaderHidden = true;
        AppLoadManager.updateLoader(1, i18n.t('loader.timeout'));
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

    // Force scroll to top on restoration - only if no hash in URL
    scrollTopIfNoHash();
  }
});

// ===== Service Worker =====
if ('serviceWorker' in navigator && !ENV.isTest) {
  if (['localhost', '127.0.0.1'].includes(globalThis.location.hostname)) {
    navigator.serviceWorker
      .getRegistrations()
      .then((r) => r.forEach((s) => s.unregister()));
  } else {
    globalThis.addEventListener(
      'load',
      () => {
        navigator.serviceWorker.register('/sw.js').then((reg) => {
          // Check for updates periodically
          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            if (!newWorker) return;
            newWorker.addEventListener('statechange', () => {
              if (
                newWorker.state === 'installed' &&
                navigator.serviceWorker.controller
              ) {
                // New SW waiting — notify user
                log.info('New Service Worker available');
                announce(
                  'Update verfügbar — Seite neu laden für die neueste Version',
                );
              }
            });
          });
        });
      },
      { once: true },
    );
  }
}

function initOfflineIndicator() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('network-status-indicator')) return;

  const indicator = document.createElement('div');
  indicator.id = 'network-status-indicator';
  indicator.className = 'network-status-indicator';
  indicator.setAttribute('role', 'status');
  indicator.setAttribute('aria-live', 'polite');
  indicator.setAttribute('aria-atomic', 'true');
  document.body.appendChild(indicator);

  let hasInitialized = false;

  const clearDismissTimer = () => {
    if (!networkIndicatorDismissTimer) return;
    appTimers.clearTimeout(networkIndicatorDismissTimer);
    networkIndicatorDismissTimer = null;
  };

  const updateIndicator = () => {
    const isOffline = navigator.onLine === false;

    clearDismissTimer();

    if (isOffline) {
      indicator.classList.add('is-visible', 'is-offline');
      indicator.classList.remove('is-online');
      indicator.textContent =
        'Offline-Modus: Navigation und lokale Suchtreffer verfuegbar, AI-Antworten eingeschraenkt.';
      announce('Offline-Modus aktiv');
      hasInitialized = true;
      return;
    }

    if (!hasInitialized) {
      hasInitialized = true;
      indicator.classList.remove('is-visible', 'is-online', 'is-offline');
      return;
    }

    indicator.classList.add('is-visible', 'is-online');
    indicator.classList.remove('is-offline');
    indicator.textContent = 'Verbindung wiederhergestellt.';
    announce('Online-Verbindung wiederhergestellt');

    networkIndicatorDismissTimer = appTimers.setTimeout(() => {
      indicator.classList.remove('is-visible', 'is-online');
      networkIndicatorDismissTimer = null;
    }, 3500);
  };

  window.addEventListener('online', updateIndicator);
  window.addEventListener('offline', updateIndicator);
  updateIndicator();
}
