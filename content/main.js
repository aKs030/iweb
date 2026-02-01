/**
 * Main Application Entry Point
 * @version 6.0.0
 * @last-modified 2026-01-25
 */

// Filter iframe console warnings in development
// @ts-ignore - Vite-specific import.meta.env
if (import.meta.env?.DEV) {
  const originalWarn = console.warn;
  const originalError = console.error;

  const shouldFilter = (message) => {
    const msg = String(message || '');
    return (
      msg.includes('touchstart') ||
      msg.includes('touchmove') ||
      msg.includes('non-passive event listener')
    );
  };

  console.warn = (...args) => {
    if (shouldFilter(args[0])) return;
    originalWarn.apply(console, args);
  };

  console.error = (...args) => {
    if (shouldFilter(args[0])) return;
    originalError.apply(console, args);
  };
}

import { initHeroFeatureBundle } from '../pages/home/hero-manager.js';
import { createLogger } from './core/logger.js';
import { EVENTS, fire } from './core/events.js';
import { a11y, createAnnouncer } from './core/accessibility-manager.js';
import { SectionManager } from './core/section-manager.js';
import { updateLoader, hideLoader } from './core/global-loader.js';
import { ThreeEarthManager } from './core/three-earth-manager.js';
import { getElementById, onDOMReady } from './core/utils.js';
import { initImageOptimization } from './core/image-loader-helper.js';
import { i18n } from './core/i18n.js';

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

/**
 * @typedef {Object} SectionData
 * @property {number} ratio
 * @property {boolean} isIntersecting
 * @property {HTMLElement} target
 */

/**
 * Section Tracker for scroll-based navigation
 */
class SectionTracker {
  constructor() {
    /** @type {Array<HTMLElement>} */
    this.sections = [];
    /** @type {Map<string, SectionData>} */
    this.sectionRatios = new Map();
    /** @type {string|null} */
    this.currentSectionId = null;
    /** @type {IntersectionObserver|null} */
    this.observer = null;
    /** @type {(() => void)|null} */
    this.refreshHandler = null;
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
    this.sections.forEach((section) => {
      if (this.observer) this.observer.observe(section);
    });

    // Use requestIdleCallback for initial check
    if (typeof window.requestIdleCallback === 'function') {
      requestIdleCallback(() => this.checkInitialSection(), { timeout: 1000 });
    } else {
      setTimeout(() => this.checkInitialSection(), 100);
    }
  }

  refreshSections() {
    const elements = Array.from(
      document.querySelectorAll('main .section[id], footer#site-footer[id]'),
    );

    /** @type {HTMLElement[]} */
    const newSections = [];
    for (const el of elements) {
      if (el instanceof HTMLElement && el.id) {
        newSections.push(el);
      }
    }

    // Only update if sections changed
    if (newSections.length !== this.sections.length) {
      this.sections = newSections;
      if (this.observer) {
        this.sections.forEach((section) => {
          if (this.observer) this.observer.observe(section);
        });
      }
    }
  }

  handleIntersections(entries) {
    let hasChanges = false;

    entries.forEach((entry) => {
      const target = /** @type {HTMLElement} */ (entry.target);
      if (target?.id) {
        const prevData = this.sectionRatios.get(target.id);
        const newData = {
          ratio: entry.intersectionRatio,
          isIntersecting: entry.isIntersecting,
          target: target,
        };

        // Only update if changed
        if (
          !prevData ||
          prevData.ratio !== newData.ratio ||
          prevData.isIntersecting !== newData.isIntersecting
        ) {
          this.sectionRatios.set(target.id, newData);
          hasChanges = true;
        }
      }
    });

    if (!hasChanges) return;

    let bestEntry = null;
    let bestRatio = 0;
    for (const section of this.sections) {
      if (!section || !section.id) continue;
      const data = this.sectionRatios.get(section.id);
      if (data && data.isIntersecting && data.ratio > bestRatio) {
        bestRatio = data.ratio;
        bestEntry = data;
      }
    }
    if (bestEntry && bestEntry.target?.id) {
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

    for (const section of this.sections) {
      if (!section) continue;
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
    }

    if (activeSection?.id && activeSection.id !== this.currentSectionId) {
      this.currentSectionId = activeSection.id;
      this.dispatchSectionChange(activeSection.id);
    }
  }

  dispatchSectionChange(sectionId) {
    try {
      const sectionIndex = this.sections.findIndex((s) => {
        if (s && typeof s.id === 'string') {
          return s.id === sectionId;
        }
        return false;
      });
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
    const foundSection = this.sections.find((s) => {
      if (s && typeof s.id === 'string') {
        return s.id === sectionId;
      }
      return false;
    });
    if (foundSection) {
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
      this.refreshHandler = null;
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
const ThreeEarthLoader = new ThreeEarthManager(ENV);

// Track if loader has been hidden
let loaderHidden = false;

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
    await i18n.init();
    perfMarks.domReady = performance.now();
    updateLoader(0.1, i18n.t('loader.status_init'));

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

      if (!loaderHidden) {
        loaderHidden = true;
        updateLoader(1, i18n.t('loader.ready_system'));
        setTimeout(() => hideLoader(), 100);
        announce('Anwendung geladen', { dedupe: true });
      }
    };

    document.addEventListener(EVENTS.LOADING_UNBLOCKED, checkReady);

    globalThis.addEventListener(
      'load',
      () => {
        perfMarks.windowLoaded = performance.now();
        windowLoaded = true;
        updateLoader(0.7, i18n.t('loader.resources'));
        checkReady();
      },
      { once: true },
    );

    updateLoader(0.2, i18n.t('loader.modules_core'));
    fire(EVENTS.CORE_INITIALIZED);
    fire(EVENTS.HERO_INIT_READY);

    updateLoader(0.3, i18n.t('loader.hero_init'));
    initHeroFeatureBundle(sectionManager);

    updateLoader(0.4, i18n.t('loader.system_3d'));
    ThreeEarthLoader.initDelayed();

    updateLoader(0.5, i18n.t('loader.optimize_images'));
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
    updateLoader(0.6, i18n.t('loader.modules_loaded'));
    fire(EVENTS.MODULES_READY);
    checkReady();

    // Force hide after timeout
    setTimeout(() => {
      if (!loaderHidden) {
        log.info('Forcing loading screen hide after timeout');
        loaderHidden = true;
        updateLoader(1, i18n.t('loader.timeout'));
        hideLoader();
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
