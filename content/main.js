/**
 * Main Application Entry Point
 * @version 6.2.0
 * @last-modified 2026-02-11
 */

import { initConsoleFilter } from './core/console-filter.js';
import { initHeroFeatureBundle } from '../pages/home/hero-manager.js';
import { createLogger } from './core/logger.js';
import { EVENTS, fire } from './core/events.js';
import { a11y, createAnnouncer } from './core/accessibility-manager.js';
import { SectionManager } from './core/section-manager.js';
import { AppLoadManager } from './core/load-manager.js';
import { ThreeEarthManager } from './core/three-earth-manager.js';
import { getElementById, onDOMReady } from './core/utils.js';
import { i18n } from './core/i18n.js';
import { initPerformanceMonitoring } from './core/performance-monitor.js';
import { SectionTracker } from './core/section-tracker.js';
import { GlobalEventHandlers } from './core/events.js';

// Search Component
import './components/search/search.js';

// Initialize console filter for development
initConsoleFilter();

const log = createLogger('main');

const schedulePersistentStorageRequest = (delay = 2500) => {
  try {
    setTimeout(async () => {
      if (!navigator?.storage) return;
      try {
        const persisted = await navigator.storage.persisted();
        if (!persisted) await navigator.storage.persist();
      } catch (error) {
        log.warn('Persistent storage request failed:', error);
      }
    }, delay);
  } catch {
    // Ignore
  }
};

// ===== Configuration & Environment =====
const ENV = {
  isTest:
    new URLSearchParams(globalThis.location.search).has('test') ||
    navigator.userAgent.includes('HeadlessChrome') ||
    (globalThis.location.hostname === 'localhost' &&
      globalThis.navigator.webdriver),
};

const STORAGE_REQUEST_DELAY_MS = 2200;

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

  sectionManager.init();

  // Start earth loading in next frame to avoid blocking DOM ready
  requestAnimationFrame(() => {
    ThreeEarthLoader.init();
  });

  try {
    a11y?.updateAnimations?.();
    a11y?.updateContrast?.();
  } catch {
    // Ignore
  }
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

    // Initialize performance monitoring
    initPerformanceMonitoring();

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
    // Earth loading already started in _initApp

    AppLoadManager.updateLoader(0.5, i18n.t('loader.optimize_images'));
    // Native browser lazy loading is sufficient
    // No custom image optimization needed

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

    schedulePersistentStorageRequest(STORAGE_REQUEST_DELAY_MS);

    // Activate deferred styles (DOM-schonend optimiert)
    try {
      document
        .querySelectorAll('link[rel="stylesheet"][data-defer="1"]')
        .forEach((link) => {
          const linkEl = /** @type {HTMLLinkElement} */ (link);
          linkEl.media = 'all';
          linkEl.removeAttribute('data-defer'); // Saubere Methode statt delete dataset
        });
    } catch {
      /* ignore */
    }

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
  }
});

// ===== Service Worker Web Component =====
class SWUpdateNotification extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          position: fixed;
          bottom: 20px;
          right: 20px;
          background: var(--color-surface, #1a1a1a);
          color: var(--color-text, #ffffff);
          padding: 16px 20px;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
          z-index: 10000;
          animation: slideIn 0.3s ease-out;
          max-width: 400px;
        }
        .sw-update-content {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .sw-update-icon {
          font-size: 24px;
        }
        .sw-update-text {
          flex: 1;
          font-size: 14px;
        }
        .sw-update-button {
          background: var(--color-primary, #0066cc);
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          transition: background 0.2s;
        }
        .sw-update-button:hover {
          background: var(--color-primary-hover, #0052a3);
        }
        .sw-update-close {
          background: transparent;
          border: none;
          color: var(--color-text-secondary, #999);
          font-size: 24px;
          cursor: pointer;
          padding: 0;
          width: 24px;
          height: 24px;
          line-height: 1;
        }
        .sw-update-close:hover {
          color: var(--color-text, #ffffff);
        }
        @keyframes slideIn {
          from {
            transform: translateY(100px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        @media (max-width: 640px) {
          :host {
            bottom: 10px;
            right: 10px;
            left: 10px;
            max-width: none;
          }
        }
      </style>
      <div class="sw-update-content">
        <span class="sw-update-icon">🔄</span>
        <span class="sw-update-text">Neue Version verfügbar!</span>
        <button class="sw-update-button" id="sw-update-reload">Aktualisieren</button>
        <button class="sw-update-close" id="sw-update-dismiss" aria-label="Schließen">×</button>
      </div>
    `;
  }

  connectedCallback() {
    this.shadowRoot
      .getElementById('sw-update-reload')
      .addEventListener('click', () => {
        window.location.reload();
      });

    this.shadowRoot
      .getElementById('sw-update-dismiss')
      .addEventListener('click', () => {
        this.remove();
      });

    // Auto-dismiss after 30 seconds
    setTimeout(() => {
      if (this.parentNode) this.remove();
    }, 30000);
  }
}

// Registriere die neue Web Component
customElements.define('sw-update-notification', SWUpdateNotification);

// ===== Service Worker Registration =====
if ('serviceWorker' in navigator && !ENV.isTest) {
  globalThis.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        log.info('Service Worker registered:', registration.scope);

        // Check for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (
                newWorker.state === 'installed' &&
                navigator.serviceWorker.controller
              ) {
                // New service worker available
                log.info('New service worker available');
                // Nutze die neue Web Component anstatt DOM Injection
                document.body.appendChild(
                  document.createElement('sw-update-notification'),
                );
              }
            });
          }
        });
      })
      .catch((error) => {
        log.warn('Service Worker registration failed:', error);
      });
  });
}
