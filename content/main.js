/**
 * Main Application Entry Point
 * @version 6.0.0
 * @last-modified 2026-01-25
 */

import { initHeroFeatureBundle } from '../pages/home/hero-manager.js';
import { createLogger } from './core/logger.js';
import { EVENTS, fire } from './core/events.js';
import { a11y, createAnnouncer } from './core/accessibility-manager.js';
import { SectionManager } from './core/section-manager.js';
import { LoaderManager } from './core/loader-manager.js';
import { ThreeEarthManager } from './core/three-earth-manager.js';
import { getElementById, onDOMReady } from './core/utils.js';
import { initImageOptimization } from './core/image-loader-helper.js';

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

const AppLoadManager = (() => {
  const pending = new Set();
  return {
    block(name) {
      if (!name) return;
      pending.add(name);
      log.debug(`Blocked: ${name}`);
    },
    unblock(name) {
      if (!name) return;
      pending.delete(name);
      log.debug(`Unblocked: ${name}`);
      if (pending.size === 0) {
        fire(EVENTS.LOADING_UNBLOCKED);
      }
    },
    isBlocked() {
      return pending.size > 0;
    },
    getPending() {
      return Array.from(pending);
    },
  };
})();

// Make AppLoadManager globally available for three-earth-system
/** @type {any} */ (globalThis).__appLoadManager = AppLoadManager;

// ===== Constants =====
const REFRESH_DELAY_MS = 50;
const LOADING_TIMEOUT_MS = 4000;
const STORAGE_REQUEST_DELAY_MS = 2200;
const SECTION_TRACKER_CONFIG = {
  threshold: [0.1, 0.3, 0.5, 0.7],
  rootMargin: '-10% 0px -10% 0px',
};

class SectionTracker {
  constructor() {
    this.sections = [];
    this.sectionRatios = new Map();
    this.currentSectionId = null;
    this.observer = null;
  }

  init() {
    onDOMReady(() => this.setupObserver());

    // Reuse single handler for both events
    this.refreshHandler = () =>
      setTimeout(() => this.refreshSections(), REFRESH_DELAY_MS);
    document.addEventListener('section:loaded', this.refreshHandler);
    document.addEventListener('footer:loaded', this.refreshHandler);
  }

  setupObserver() {
    this.refreshSections();
    if (!window.IntersectionObserver || this.sections.length === 0) return;
    this.observer = new IntersectionObserver(
      (entries) => this.handleIntersections(entries),
      SECTION_TRACKER_CONFIG,
    );
    this.sections.forEach((section) => this.observer.observe(section));
    this.checkInitialSection();
  }

  refreshSections() {
    this.sections = Array.from(
      document.querySelectorAll('main .section[id], footer#site-footer[id]'),
    ).filter((section) => section.id);
    if (this.observer) {
      this.sections.forEach((section) => this.observer.observe(section));
    }
  }

  handleIntersections(entries) {
    entries.forEach((entry) => {
      if (entry.target?.id) {
        this.sectionRatios.set(entry.target.id, {
          ratio: entry.intersectionRatio,
          isIntersecting: entry.isIntersecting,
          target: entry.target,
        });
      }
    });
    let bestEntry = null;
    let bestRatio = 0;
    for (const section of this.sections) {
      const data = this.sectionRatios.get(section.id);
      if (data && data.isIntersecting && data.ratio > bestRatio) {
        bestRatio = data.ratio;
        bestEntry = data;
      }
    }
    if (bestEntry) {
      const newSectionId = bestEntry.target.id;
      if (newSectionId !== this.currentSectionId) {
        this.currentSectionId = newSectionId;
        this.dispatchSectionChange(newSectionId);
      }
    }
  }

  checkInitialSection() {
    const viewportCenter = window.innerHeight / 2;
    /** @type {HTMLElement|null} */
    let activeSection = null;
    let bestDistance = Infinity;
    this.sections.forEach((section) => {
      const rect = section.getBoundingClientRect();
      const sectionCenter = rect.top + rect.height / 2;
      const distance = Math.abs(sectionCenter - viewportCenter);
      if (
        distance < bestDistance &&
        rect.top < viewportCenter &&
        rect.bottom > viewportCenter
      ) {
        bestDistance = distance;
        activeSection = section;
      }
    });
    if (activeSection && activeSection.id !== this.currentSectionId) {
      this.currentSectionId = activeSection.id;
      this.dispatchSectionChange(activeSection.id);
    }
  }

  dispatchSectionChange(sectionId) {
    try {
      const sectionIndex = this.sections.findIndex((s) => s.id === sectionId);
      const section = getElementById(sectionId);
      const detail = {
        id: /** @type {string} */ (sectionId),
        index: sectionIndex,
        section,
      };
      window.dispatchEvent(new CustomEvent('snapSectionChange', { detail }));
      log.debug(`Section changed: ${sectionId}`);
    } catch (error) {
      log.warn('Failed to dispatch section change:', error);
    }
  }

  updateCurrentSection(sectionId) {
    if (this.sections.find((s) => s.id === sectionId)) {
      this.currentSectionId = sectionId;
      this.dispatchSectionChange(sectionId);
    }
  }

  destroy() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    if (this.refreshHandler) {
      document.removeEventListener('section:loaded', this.refreshHandler);
      document.removeEventListener('footer:loaded', this.refreshHandler);
    }
    this.sections = [];
    this.sectionRatios.clear();
    this.currentSectionId = null;
  }
}

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

let _appInitialized = false;

const _initApp = () => {
  if (_appInitialized) {
    log.debug('App already initialized, skipping duplicate init');
    return;
  }
  _appInitialized = true;

  sectionManager.init();
  try {
    a11y?.updateAnimations?.();
    a11y?.updateContrast?.();
  } catch {
    // Ignore
  }
};

onDOMReady(_initApp);

// ===== Initialize Managers =====
const LoadingScreenManager = new LoaderManager();
const ThreeEarthLoader = new ThreeEarthManager(ENV);

// ===== Event Handlers =====
const EventHandlers = {
  handleRetry(event) {
    const retry = event.target?.closest('.retry-btn');
    if (!retry) return;

    event.preventDefault();
    try {
      globalThis.location.reload();
    } catch {
      /* fallback */
    }
  },

  async handleShare(event) {
    const share = event.target?.closest('.btn-share');
    if (!share) return;

    event.preventDefault();
    const shareUrl =
      share.dataset.shareUrl || 'https://www.youtube.com/@aks.030';
    const shareData = {
      title: document.title,
      text: 'Schau dir diesen Kanal an',
      url: shareUrl,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        log.warn('share failed', err);
      }
    } else if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(shareUrl);
        announce('Link kopiert', { dedupe: true });
      } catch (err) {
        log.warn('Copy failed', err);
      }
    } else {
      try {
        globalThis.prompt('Link kopieren', shareUrl);
      } catch (err) {
        log.warn('prompt failed', err);
      }
    }
  },

  handleClick(event) {
    this.handleRetry(event);
    this.handleShare(event);
  },
};

// ===== Application Bootstrap =====
document.addEventListener(
  'DOMContentLoaded',
  async () => {
    perfMarks.domReady = performance.now();
    LoadingScreenManager.init();

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
      if (!modulesReady || !windowLoaded) return;
      if (AppLoadManager?.isBlocked?.()) return;
      if (!isEarthReady()) return;

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
    initHeroFeatureBundle(sectionManager);

    ThreeEarthLoader.initDelayed();

    // Initialize image optimization
    initImageOptimization({
      autoOptimize: true,
      preloadCritical: true,
      lazyLoadSelector: 'img[loading="lazy"]',
    }).catch((error) => {
      log.warn('Image optimization init failed:', error);
    });

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
    }, LOADING_TIMEOUT_MS);

    schedulePersistentStorageRequest(STORAGE_REQUEST_DELAY_MS);

    // Activate deferred styles
    try {
      document
        .querySelectorAll('link[rel="stylesheet"][data-defer="1"]')
        .forEach((link) => {
          const linkEl = /** @type {HTMLLinkElement} */ (link);
          linkEl.media = 'all';
          const datasetEl = /** @type {HTMLElement} */ (link);
          delete datasetEl.dataset.defer;
        });
    } catch {
      /* ignore */
    }

    // Event delegation
    document.addEventListener('click', (event) =>
      EventHandlers.handleClick(event),
    );

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
