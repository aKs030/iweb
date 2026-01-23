/**
 * Shared Utilities - Refactored and Modularized
 * @version 5.0.0 - Split into specialized modules for better performance
 */

// ===== Logger System (kept here as it's used everywhere) =====

const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

let globalLogLevel = LOG_LEVELS.warn;

function setGlobalLogLevel(level) {
  const validLevels = ['error', 'warn', 'info', 'debug'];
  if (validLevels.includes(level)) {
    globalLogLevel = LOG_LEVELS[level];
  }
}

export function createLogger(category) {
  const prefix = `[${category}]`;
  const console = globalThis.console || {};
  const noop = () => {};

  return {
    error: (message, ...args) => {
      if (globalLogLevel >= LOG_LEVELS.error) {
        (console.error || noop)(prefix, message, ...args);
      }
    },
    warn: (message, ...args) => {
      if (globalLogLevel >= LOG_LEVELS.warn) {
        (console.warn || noop)(prefix, message, ...args);
      }
    },
    info: (message, ...args) => {
      if (globalLogLevel >= LOG_LEVELS.info) {
        (console.info || noop)(prefix, message, ...args);
      }
    },
    debug: (message, ...args) => {
      if (globalLogLevel >= LOG_LEVELS.debug) {
        (console.debug || noop)(prefix, message, ...args);
      }
    },
  };
}

// Auto-enable debug mode
if (typeof window !== 'undefined') {
  const urlParams = new URLSearchParams(window.location.search);
  const debugParam = urlParams.get('debug');
  const debugStorage = window.localStorage?.getItem('iweb-debug');

  if (debugParam === 'true' || debugStorage === 'true') {
    setGlobalLogLevel('debug');
  }
}

// ===== Re-exports from specialized modules =====

// DOM utilities
export {
  getElementById,
  makeAbortController,
  clearDOMCache,
} from './dom/dom-helpers.js';
import { makeAbortController } from './dom/dom-helpers.js';

// Timing utilities
export { throttle, debounce, TimerManager, onResize } from './timing.js';

// Events system
export { EVENTS, fire, addListener, AppLoadManager } from './events.js';

// Math utilities
export {
  randomInt,
  shuffle,
  clamp,
  lerp,
  map,
  easeInOut,
  distance,
  angle,
} from './math.js';

// ===== Intersection Observer Utilities =====
// Import centralized observer utilities to avoid duplication
import { createObserver } from './observers/intersection-observer.js';

const OBSERVER_CONFIGS = {
  lazyLoad: {
    threshold: 0.15,
    rootMargin: '120px 0px',
  },
  sectionTracking: {
    threshold: [0.1, 0.3, 0.5, 0.7],
    rootMargin: '-10% 0px -10% 0px',
  },
};

// Simplified wrappers using the centralized observer utilities
export function createLazyLoadObserver(
  callback,
  options = OBSERVER_CONFIGS.lazyLoad,
) {
  const observer = createObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        observer.unobserve(entry.target);
        callback(entry.target);
      }
    });
  }, options);
  return observer;
}

export function createTriggerOnceObserver(callback, options = {}) {
  const observer = createObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        callback(entry.target);
        // Disconnect after first trigger
        observer.disconnect();
      }
    });
  }, options);
  return observer;
}

// ===== Section Tracker (kept here as it's complex and used in main.js) =====

export class SectionTracker {
  constructor() {
    this.sections = [];
    this.currentSection = null;
    this.observer = null;
    this.log = createLogger('SectionTracker');
  }

  init() {
    this.refreshSections();

    if (!window.IntersectionObserver) {
      this.log.warn('IntersectionObserver unavailable');
      return;
    }

    if (this.sections.length === 0) {
      this.log.debug('No sections found to track');
      return;
    }

    this.observer = new IntersectionObserver(
      (entries) => this.handleIntersections(entries),
      OBSERVER_CONFIGS.sectionTracking,
    );

    this.sections.forEach((section) => {
      this.observer.observe(section);
    });

    this.log.info(`Tracking ${this.sections.length} sections`);
  }

  refreshSections() {
    this.sections = Array.from(
      document.querySelectorAll('section[id], .section[id], [data-section]'),
    ).filter((el) => el.id || el.dataset.section);

    this.log.debug(`Found ${this.sections.length} sections`);
  }

  handleIntersections(entries) {
    const visibleSections = entries
      .filter((entry) => entry.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

    if (visibleSections.length > 0) {
      const newSection = visibleSections[0].target;
      const sectionId = newSection.id || newSection.dataset.section;

      if (this.currentSection !== sectionId) {
        this.currentSection = sectionId;

        // Import fire function dynamically to avoid circular dependency
        import('./events.js').then(({ fire, EVENTS }) => {
          fire(EVENTS.SECTION_CHANGE, {
            section: sectionId,
            element: newSection,
          });
        });

        this.log.debug(`Section changed to: ${sectionId}`);
      }
    }
  }

  getCurrentSection() {
    return this.currentSection;
  }

  destroy() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    this.sections = [];
    this.currentSection = null;
    this.log.debug('SectionTracker destroyed');
  }
}

// ===== Persistent Storage (Simplified) =====

export function schedulePersistentStorageRequest(delay = 2500) {
  setTimeout(() => {
    if (navigator?.storage?.persist) {
      navigator.storage
        .persist()
        .then((granted) => {
          const log = createLogger('PersistentStorage');
          if (granted) {
            log.info('Persistent storage granted');
          } else {
            log.debug('Persistent storage not granted');
          }
        })
        .catch(() => {
          // Silent fail
        });
    }
  }, delay);
}

// ===== Fetch Utilities =====

export async function fetchWithTimeout(url, options = {}) {
  const { timeout = 8000, ...fetchOptions } = options;

  const controller = makeAbortController(timeout);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeout}ms`);
    }
    throw error;
  }
}

// Export setGlobalLogLevel for logger registry
export { setGlobalLogLevel };
