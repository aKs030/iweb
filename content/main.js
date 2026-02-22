/**
 * Main Application Entry Point
 * @version 6.2.0
 * @last-modified 2026-02-11
 */

import { initConsoleFilter } from './core/utils.js';
import { initHeroFeatureBundle } from '../pages/home/hero-manager.js';
import { createLogger } from './core/logger.js';
import { EVENTS, fire } from './core/events.js';
import { a11y, createAnnouncer } from './core/accessibility-manager.js';
import { SectionManager } from './core/section-manager.js';
import { AppLoadManager } from './core/load-manager.js';
import { ThreeEarthManager } from './core/three-earth-manager.js';
import { getElementById, onDOMReady } from './core/utils.js';
import { initViewTransitions } from './core/view-transitions.js';
import { i18n } from './core/i18n.js';
import { SectionTracker } from './core/section-tracker.js';
import { GlobalEventHandlers } from './core/events.js';

// Initialize console filter for development
initConsoleFilter();

const log = createLogger('main');

// Persistent storage request removed to avoid deprecation warnings

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
  TIMEOUT_MS: 8000, // Increased from 4000ms to 8000ms for slower networks
  EARTH_INIT_DELAY: 500, // Reduced from 2000ms to 500ms
  MODULE_READY_DELAY: 300, // Reduced from 600ms to 300ms
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

let _appInitialized = false;

const _initApp = () => {
  if (_appInitialized) {
    log.debug('App already initialized, skipping duplicate init');
    return;
  }
  _appInitialized = true;

  // Scroll to top on init (Safari compatibility) - only if no hash in URL
  if (!window.location.hash) {
    window.scrollTo(0, 0);
    setTimeout(() => window.scrollTo(0, 0), 100);
  }

  sectionManager.init();

  // Start earth loading in next frame to avoid blocking DOM ready
  requestAnimationFrame(() => {
    ThreeEarthLoader.init();
  });

  try {
    a11y?.updateAnimations?.();
    a11y?.updateContrast?.();
  } catch {}

  // Initialize View Transitions API (progressive enhancement)
  initViewTransitions();
};

onDOMReady(_initApp);

// ===== Initialize Managers =====
const ThreeEarthLoader = new ThreeEarthManager(ENV);

// Track if loader has been hidden
let loaderHidden = false;

// ===== Application Bootstrap =====
document.addEventListener(
  'DOMContentLoaded',
  async () => {
    await i18n.init();
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
      setTimeout(() => AppLoadManager.hideLoader(), 100);
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
    setTimeout(() => {
      if (!loaderHidden) {
        log.info('Forcing loading screen hide after timeout');
        loaderHidden = true;
        AppLoadManager.updateLoader(1, i18n.t('loader.timeout'));
        AppLoadManager.hideLoader();
      }
    }, LOADING_CONFIG.TIMEOUT_MS);

    // Initialize global event handlers
    GlobalEventHandlers.init(announce);

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
    if (!window.location.hash) {
      window.scrollTo(0, 0);
    }
  }
});

// Safari Hack: scroll to top before unloading so it remembers 0 as scroll state
globalThis.addEventListener('beforeunload', () => {
  window.scrollTo(0, 0);
});

// ===== Service Worker Registration =====
if ('serviceWorker' in navigator && !ENV.isTest) {
  const isLocal = ['localhost', '127.0.0.1'].includes(
    globalThis.location.hostname,
  );

  if (isLocal) {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((reg) => reg.unregister());
    });
  } else {
    globalThis.addEventListener('load', async () => {
      try {
        const version =
          document.querySelector('meta[name="version"]')?.content || Date.now();
        const reg = await navigator.serviceWorker.register(
          `/sw.js?v=${version}`,
        );

        reg.addEventListener('updatefound', () => {
          const worker = reg.installing;
          if (!worker) return;

          worker.addEventListener('statechange', () => {
            if (
              worker.state === 'installed' &&
              navigator.serviceWorker.controller
            ) {
              const notification = document.createElement('div');
              notification.innerHTML = `
                <div style="position:fixed;bottom:20px;right:20px;background:#1a1a1a;color:#fff;padding:16px 20px;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.3);z-index:10000;max-width:400px;">
                  <div style="display:flex;align-items:center;gap:12px;">
                    <span style="font-size:24px;">🔄</span>
                    <span style="flex:1;font-size:14px;">Neue Version verfügbar!</span>
                    <button onclick="location.reload()" style="background:#0066cc;color:#fff;border:none;padding:8px 16px;border-radius:4px;cursor:pointer;font-size:14px;font-weight:500;">Aktualisieren</button>
                    <button onclick="this.parentElement.parentElement.remove()" style="background:transparent;border:none;color:#999;font-size:24px;cursor:pointer;padding:0;width:24px;height:24px;">×</button>
                  </div>
                </div>
              `;
              document.body.appendChild(notification.firstElementChild);
              setTimeout(() => notification.firstElementChild?.remove(), 30000);
            }
          });
        });
      } catch (error) {
        log.warn('Service Worker registration failed:', error);
      }
    });
  }
}
