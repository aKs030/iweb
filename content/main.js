/**
 * Main Application Entry Point
 * @version 6.0.0
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
  getElementById,
} from '/content/core/shared-utilities.js';
import { a11y, createAnnouncer } from './core/accessibility-manager.js';
import { SectionManager } from './core/section-manager.js';
import { LoaderManager } from './core/loader-manager.js';
import { ThreeEarthManager } from './core/three-earth-manager.js';
import './components/menu/menu.js';

const log = createLogger('main');

// ===== Configuration & Environment =====
const ENV = {
  isTest:
    new URLSearchParams(globalThis.location.search).has('test') ||
    navigator.userAgent.includes('HeadlessChrome') ||
    (globalThis.location.hostname === 'localhost' &&
      globalThis.navigator.webdriver),
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
const LoadingScreenManager = new LoaderManager();
const ThreeEarthLoader = new ThreeEarthManager(ENV);

// ===== Event Handlers (inline) =====
function handleRetryClick(event) {
  const retry = event.target?.closest('.retry-btn');
  if (retry) {
    event.preventDefault();
    try {
      globalThis.location.reload();
    } catch {
      /* fallback */
    }
  }
}

function handleShareClick(event) {
  const share = event.target?.closest('.btn-share');
  if (!share) return;

  event.preventDefault();
  const shareUrl = share.dataset.shareUrl || 'https://www.youtube.com/@aks.030';
  const shareData = {
    title: document.title,
    text: 'Schau dir diesen Kanal an',
    url: shareUrl,
  };

  if (navigator.share) {
    navigator.share(shareData).catch((err) => log.warn('share failed', err));
  } else if (navigator.clipboard) {
    navigator.clipboard.writeText(shareUrl).then(() => {
      try {
        announce('Link kopiert', { dedupe: true });
      } catch (err) {
        log.warn('announce failed', err);
      }
    });
  } else {
    try {
      globalThis.prompt('Link kopieren', shareUrl);
    } catch (err) {
      log.warn('prompt failed', err);
    }
  }
}

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
      const earthContainer =
        getElementById('threeEarthContainer') ||
        getElementById('earth-container');
      const earthReady = earthContainer?.dataset?.threeReady === '1';
      if (earthContainer && !earthReady) {
        return;
      }

      LoadingScreenManager.hide();
      announce('Anwendung geladen', { dedupe: true });
    };

    document.addEventListener(EVENTS.LOADING_UNBLOCKED, checkReady);

    globalThis.addEventListener(
      'load',
      () => {
        perfMarks.windowLoaded = performance.now();
        windowLoaded = true;
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
    fire(EVENTS.MODULES_READY);
    checkReady();

    // Force hide after timeout
    setTimeout(() => {
      if (!windowLoaded) {
        log.info('Forcing loading screen hide after timeout');
        LoadingScreenManager.hide();
      }
    }, 4000);

    schedulePersistentStorageRequest(2200);

    // Activate deferred styles
    try {
      document
        .querySelectorAll('link[rel="stylesheet"][data-defer="1"]')
        .forEach((link) => {
          link.media = 'all';
          delete link.dataset.defer;
        });
    } catch {
      /* ignore */
    }

    // Event delegation
    document.addEventListener('click', (event) => {
      handleRetryClick(event);
      handleShareClick(event);
    });

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
