/**
 * Shared Utilities - Optimized Core Functions
 *
 * OPTIMIZATIONS v3.0:
 * - Removed unused OBSERVER_CONFIGS.heroLoading
 * - Consolidated duplicate event handling
 * - Improved type safety
 * OPTIMIZATIONS v3.1.0:
 * - SectionTracker query updated to include footer.
 *
 * @version 3.1.0
 * @last-modified 2025-11-08
 */

// ===== Logger System =====

const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
};

let globalLogLevel = LOG_LEVELS.warn;

export function setGlobalLogLevel(level) {
  if (level in LOG_LEVELS) {
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
        (console.debug || console.log || noop)(prefix, message, ...args);
      }
    }
  };
}

const sharedLogger = createLogger('SharedUtilities');

// Auto-enable debug mode
if (typeof window !== 'undefined') {
  const urlParams = new URLSearchParams(window.location.search);
  const debugParam = urlParams.get('debug');
  const debugStorage = window.localStorage?.getItem('iweb-debug');

  if (debugParam === 'true' || debugStorage === 'true') {
    setGlobalLogLevel('debug');
  }
}

// ===== DOM Utilities =====

const elementCache = new Map();
const CACHE_MAX_SIZE = 20;

export function getElementById(id, useCache = true) {
  if (!id) return null;

  if (useCache && elementCache.has(id)) {
    const cached = elementCache.get(id);
    if (cached && document.contains(cached)) {
      return cached;
    }
    elementCache.delete(id);
  }

  const element = document.getElementById(id);

  if (useCache && element) {
    if (elementCache.size >= CACHE_MAX_SIZE) {
      const firstKey = elementCache.keys().next().value;
      elementCache.delete(firstKey);
    }
    elementCache.set(id, element);
  }

  return element;
}

// ===== Array Utilities =====

export function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ===== Timing Utilities =====

export function throttle(func, limit = 250) {
  let inThrottle = false;
  return function (...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

export function debounce(func, wait = 100) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

// ===== Timer Manager =====

export class TimerManager {
  constructor() {
    this.timers = new Set();
    this.intervals = new Set();
  }

  setTimeout(callback, delay) {
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      callback();
    }, delay);
    this.timers.add(timer);
    return timer;
  }

  clearTimeout(timer) {
    clearTimeout(timer);
    this.timers.delete(timer);
  }

  setInterval(callback, delay) {
    const interval = setInterval(callback, delay);
    this.intervals.add(interval);
    return interval;
  }

  clearInterval(interval) {
    clearInterval(interval);
    this.intervals.delete(interval);
  }

  clearAll() {
    this.timers.forEach(clearTimeout);
    this.intervals.forEach(clearInterval);
    this.timers.clear();
    this.intervals.clear();
  }

  sleep(ms) {
    return new Promise((resolve) => {
      this.setTimeout(resolve, ms);
    });
  }

  scheduleAsync(callback, delay) {
    return new Promise((resolve, reject) => {
      this.setTimeout(async () => {
        try {
          const result = await callback();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      }, delay);
    });
  }

  get activeCount() {
    return this.timers.size + this.intervals.size;
  }
}

// ===== Events System =====

export const EVENTS = Object.freeze({
  HERO_LOADED: 'hero:loaded',
  HERO_TYPING_END: 'hero:typingEnd',
  FEATURES_TEMPLATES_LOADED: 'featuresTemplatesLoaded',
  FEATURES_TEMPLATES_ERROR: 'featuresTemplatesError',
  TEMPLATE_MOUNTED: 'template:mounted',
  FEATURES_CHANGE: 'features:change',
  DOM_READY: 'app:domReady',
  CORE_INITIALIZED: 'app:coreInitialized',
  MODULES_READY: 'app:modulesReady',
  HERO_INIT_READY: 'app:heroInitReady'
});

export function fire(type, detail = null, target = document) {
  if (!target?.dispatchEvent) return;

  try {
    target.dispatchEvent(new CustomEvent(type, { detail }));
  } catch (error) {
    sharedLogger.warn(`Failed to dispatch event: ${type}`, error);
  }
}

export function on(type, handler, options = {}, target = document) {
  // Normalize parameters
  let actualTarget = target;
  let actualOptions = options;

  if (options?.addEventListener) {
    actualTarget = options;
    actualOptions = {};
  }

  if (!actualTarget?.addEventListener) {
    return () => {};
  }

  try {
    actualTarget.addEventListener(type, handler, actualOptions);
    return () => actualTarget.removeEventListener(type, handler, actualOptions);
  } catch (error) {
    sharedLogger.warn(`Failed to add event listener: ${type}`, error);
    return () => {};
  }
}

// ===== Event Listener Manager =====

// Deprecated: EventListenerManager removed to reduce footprint.
// If you relied on EventListenerManager, please use `addListener` which
// returns an unregister function: `const cleanup = addListener(el, 'click', onClick)`.

// ===== Visibility Change Handler =====

export function onVisibilityChange(callback) {
  if (typeof document === 'undefined' || !document.addEventListener) return () => {};

  const handler = () => callback(!document.hidden);

  try {
    // Use addListener helper so we get a proper cleanup function
    return addListener(document, 'visibilitychange', handler, { passive: true });
  } catch (error) {
    sharedLogger.error('onVisibilityChange setup failed:', error);
    return () => {};
  }
}

// ===== Intersection Observer Utilities =====

// ===== OPTIMIZED: Removed unused heroLoading config =====
export const OBSERVER_CONFIGS = {
  lazyLoad: {
    threshold: 0.15,
    rootMargin: '120px 0px'
  },
  sectionTracking: {
    threshold: [0.1, 0.3, 0.5, 0.7],
    rootMargin: '-10% 0px -10% 0px'
  }
};

function createObserverWrapper(callback, options, triggerOnce = false) {
  if (!window.IntersectionObserver) {
    sharedLogger.warn('IntersectionObserver not available - using fallback');
    return {
      observer: null,
      observe: (element) => {
        if (triggerOnce) {
          setTimeout(() => callback(element), 0);
        } else {
          callback(element);
        }
      },
      disconnect: () => {}
    };
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        if (triggerOnce) {
          observer.unobserve(entry.target);
        }
        callback(entry.target);
      }
    });
  }, options);

  return {
    observer,
    observe: (element) => observer.observe(element),
    disconnect: () => observer.disconnect()
  };
}

export function createLazyLoadObserver(callback, options = OBSERVER_CONFIGS.lazyLoad) {
  return createObserverWrapper(callback, options, true);
}

export function createTriggerOnceObserver(callback, options = {}) {
  if (!window.IntersectionObserver) {
    setTimeout(callback, 0);
    return {
      observer: null,
      observe: () => {},
      disconnect: () => {}
    };
  }

  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        observer.disconnect();
        callback();
        break;
      }
    }
  }, options);

  return {
    observer,
    observe: (element) => observer.observe(element),
    disconnect: () => observer.disconnect()
  };
}

// ===== Persistent Storage Utilities =====

let persistPromise = null;

export async function ensurePersistentStorage() {
  if (persistPromise) return persistPromise;

  persistPromise = (async () => {
    if (!navigator?.storage) {
      return { supported: false, persisted: false };
    }

    const storage = navigator.storage;
    let persisted = false;

    try {
      if (storage.persisted) {
        persisted = await storage.persisted().catch(() => false);
      }

      if (!persisted && storage.persist) {
        persisted = await storage.persist().catch(() => false);
      }

      let quota = null;
      if (storage.estimate) {
        const estimate = await storage.estimate().catch(() => null);
        if (estimate) {
          quota = {
            quota: estimate.quota,
            usage: estimate.usage,
            usageDetails: estimate.usageDetails
          };
        }
      }

      return { supported: true, persisted, quota };
    } catch (error) {
      sharedLogger.warn('Persistent storage check failed:', error);
      return { supported: false, persisted: false };
    }
  })();

  return persistPromise;
}

export function schedulePersistentStorageRequest(delay = 2500) {
  try {
    setTimeout(() => {
      ensurePersistentStorage().catch(() => {});
    }, delay);
  } catch {
    // Fail silently
  }
}

// ===== Math Utilities =====

export function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ===== Unified Event Listener Helper =====

export function addListener(target, event, handler, options = {}) {
  if (!target?.addEventListener) return () => {};

  const finalOptions = { passive: true, ...options };

  try {
    target.addEventListener(event, handler, finalOptions);
    return () => target.removeEventListener(event, handler, finalOptions);
  } catch {
    return () => {};
  }
}

// ===== Window Event Helpers =====

export function onResize(callback, delay = 100) {
  if (typeof window === 'undefined') return () => {};

  const debouncedCallback = debounce(callback, delay);
  return addListener(window, 'resize', debouncedCallback);
}

export function onScroll(callback, target = window, throttleMs = 16) {
  const throttledCallback = throttle(callback, throttleMs);
  return addListener(target, 'scroll', throttledCallback);
}

// ===== Pointer Events Helper =====

export function setupPointerEvents(element, { onStart, onMove, onEnd }, options = {}) {
  const cleanupFunctions = [];

  const createHandler = (callback) => (e) => callback?.(e);

  // Mouse events
  cleanupFunctions.push(
    addListener(element, 'mousedown', createHandler(onStart), { passive: false, ...options }),
    addListener(element, 'mousemove', createHandler(onMove), { passive: true, ...options }),
    addListener(element, 'mouseup', createHandler(onEnd), { passive: true, ...options }),
    addListener(element, 'mouseleave', createHandler(onEnd), { passive: true, ...options })
  );

  // Touch events
  cleanupFunctions.push(
    addListener(element, 'touchstart', createHandler(onStart), { passive: false, ...options }),
    addListener(element, 'touchmove', createHandler(onMove), { passive: true, ...options }),
    addListener(element, 'touchend', createHandler(onEnd), { passive: true, ...options }),
    addListener(element, 'touchcancel', createHandler(onEnd), { passive: true, ...options })
  );

  return () => {
    cleanupFunctions.forEach((cleanup) => cleanup());
  };
}

// ===== Section Tracker =====

export class SectionTracker {
  constructor() {
    this.sections = [];
    this.currentSectionId = null;
    this.observer = null;
    this.log = createLogger('SectionTracker');
  }

  init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setupObserver(), { once: true });
    } else {
      setTimeout(() => this.setupObserver(), 100);
    }

    document.addEventListener('section:loaded', () => {
      setTimeout(() => this.refreshSections(), 50);
    });
  }

  setupObserver() {
    this.refreshSections();

    if (!window.IntersectionObserver || this.sections.length === 0) {
      this.log.warn('IntersectionObserver unavailable or no sections found');
      return;
    }

    this.observer = new IntersectionObserver(
      (entries) => this.handleIntersections(entries),
      OBSERVER_CONFIGS.sectionTracking
    );

    this.sections.forEach((section) => {
      this.observer.observe(section);
    });

    this.checkInitialSection();
  }

  refreshSections() {
    // FIX: Selektor erweitert, um main-Sektionen UND den site-footer zu erfassen
    this.sections = Array.from(
      document.querySelectorAll('main .section[id], footer#site-footer[id]')
    ).filter((section) => section.id);

    if (this.observer) {
      this.sections.forEach((section) => {
        this.observer.observe(section);
      });
    }

    this.log.debug(`Tracking ${this.sections.length} sections`);
  }

  handleIntersections(entries) {
    let bestEntry = null;
    let bestRatio = 0;

    entries.forEach((entry) => {
      if (entry.isIntersecting && entry.intersectionRatio > bestRatio) {
        bestRatio = entry.intersectionRatio;
        bestEntry = entry;
      }
    });

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
    let activeSection = null;
    let bestDistance = Infinity;

    this.sections.forEach((section) => {
      const rect = section.getBoundingClientRect();
      const sectionCenter = rect.top + rect.height / 2;
      const distance = Math.abs(sectionCenter - viewportCenter);

      if (distance < bestDistance && rect.top < viewportCenter && rect.bottom > viewportCenter) {
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

      const detail = { id: sectionId, index: sectionIndex, section };
      window.dispatchEvent(new CustomEvent('snapSectionChange', { detail }));

      this.log.debug(`Section changed: ${sectionId}`);
    } catch (error) {
      this.log.warn('Failed to dispatch section change:', error);
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
    this.sections = [];
    this.currentSectionId = null;
  }
}
