/**
 * Shared Utilities
 * @version 3.2.0
 */

const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

function isProduction() {
  if (typeof window === 'undefined') return false;
  const hostname = window.location?.hostname || '';
  return (
    hostname &&
    hostname !== 'localhost' &&
    hostname !== '127.0.0.1' &&
    !hostname.startsWith('192.168.') &&
    !hostname.startsWith('10.') &&
    window.location.protocol !== 'file:'
  );
}

let globalLogLevel = isProduction() ? LOG_LEVELS.error : LOG_LEVELS.warn;

function setGlobalLogLevel(level) {
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
      // Skip warnings in production unless explicitly enabled
      if (globalLogLevel >= LOG_LEVELS.warn) {
        (console.warn || noop)(prefix, message, ...args);
      }
    },
    info: (message, ...args) => {
      // Skip info in production unless explicitly enabled
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

const sharedLogger = createLogger('SharedUtilities');

if (typeof window !== 'undefined') {
  const urlParams = new URLSearchParams(window.location.search);
  const debugParam = urlParams.get('debug');
  const debugStorage = window.localStorage?.getItem('iweb-debug');

  if (debugParam === 'true' || debugStorage === 'true') {
    setGlobalLogLevel('debug');
  }
}

export async function fetchWithTimeout(url, timeout = 8000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      credentials: 'same-origin',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

export async function fetchJSON(url, timeout = 8000) {
  const response = await fetchWithTimeout(url, timeout);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  return await response.json();
}

export async function fetchText(url, timeout = 8000) {
  const response = await fetchWithTimeout(url, timeout);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  return await response.text();
}

export function makeAbortController(timeout) {
  const controller = new AbortController();
  let timeoutId = null;
  if (typeof timeout === 'number') {
    timeoutId = setTimeout(() => controller.abort(), timeout);
  }
  return {
    controller,
    cancel: () => {
      if (timeoutId) clearTimeout(timeoutId);
      controller.abort();
    },
    clearTimeout: () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = null;
    },
  };
}

export function getElementById(id) {
  return id ? document.getElementById(id) : null;
}
export function onDOMReady(callback) {
  if (document.readyState !== 'loading') {
    callback();
  } else {
    document.addEventListener('DOMContentLoaded', callback, { once: true });
  }
}

export function safeExecute(fn, fallback = null) {
  try {
    return fn();
  } catch (error) {
    if (globalLogLevel >= LOG_LEVELS.debug) {
      sharedLogger.debug('safeExecute caught error:', error);
    }
    return fallback;
  }
}

export async function safeExecuteAsync(fn, fallback = null) {
  try {
    return await fn();
  } catch (error) {
    if (globalLogLevel >= LOG_LEVELS.debug) {
      sharedLogger.debug('safeExecuteAsync caught error:', error);
    }
    return fallback;
  }
}
export const CookieManager = {
  set(name, value, days = 365) {
    const date = new Date();
    date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
    const expires = `; expires=${date.toUTCString()}`;
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${name}=${value || ''}${expires}; path=/; SameSite=Lax${secure}`;
  },

  get(name) {
    const nameEQ = `${name}=`;
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
      cookie = cookie.trim();
      if (cookie.startsWith(nameEQ)) {
        return cookie.substring(nameEQ.length);
      }
    }
    return null;
  },

  delete(name) {
    const domains = [
      '',
      window.location.hostname,
      `.${window.location.hostname}`,
    ];
    domains.forEach((domain) => {
      const domainPart = domain ? `; domain=${domain}` : '';
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/${domainPart}`;
    });
  },

  deleteAnalytics() {
    const analyticsCookies = ['_ga', '_gid', '_gat', '_gat_gtag_G_S0587RQ4CN'];
    analyticsCookies.forEach((name) => this.delete(name));
    sharedLogger.info('Analytics cookies deleted');
  },
};

export function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

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

export const AppLoadManager = (() => {
  const pending = new Set();
  const log = createLogger('AppLoadManager');

  return {
    block(name) {
      if (!name) return;
      pending.add(name);
      try {
        log.debug(`Blocked: ${name}`);
      } catch {
        // Ignore logging errors
      }
    },

    unblock(name) {
      if (!name) return;
      pending.delete(name);
      try {
        log.debug(`Unblocked: ${name}`);
        if (pending.size === 0) {
          fire(EVENTS.LOADING_UNBLOCKED);
        }
      } catch {
        // Ignore logging errors
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
  HERO_INIT_READY: 'app:heroInitReady',
  SW_UPDATE_AVAILABLE: 'sw:updateAvailable',
  LOADING_UNBLOCKED: 'app:loadingUnblocked',
  LOADING_HIDE: 'app:loaderHide',
});

export function fire(type, detail = null, target = document) {
  if (!target?.dispatchEvent) return;

  try {
    target.dispatchEvent(new CustomEvent(type, { detail }));
  } catch (error) {
    if (typeof process === 'undefined' || process.env.NODE_ENV !== 'test') {
      sharedLogger.warn(`Failed to dispatch event: ${type}`, error);
    }
  }
}

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

export function createTriggerOnceObserver(callback, options = {}) {
  if (!window.IntersectionObserver) {
    setTimeout(callback, 0);
    return {
      observer: null,
      observe: () => {},
      disconnect: () => {},
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
    disconnect: () => observer.disconnect(),
  };
}

let persistPromise = null;

async function ensurePersistentStorage() {
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
            usageDetails: estimate.usageDetails,
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
      ensurePersistentStorage().catch((err) => {
        sharedLogger.warn('ensurePersistentStorage failed', err);
      });
    }, delay);
  } catch {
    // Ignore scheduling errors
  }
}

export function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function addListener(target, event, handler, options = {}) {
  if (!target?.addEventListener) return () => {};

  const finalOptions = { passive: true, ...options };

  try {
    target.addEventListener(event, handler, finalOptions);
    return () => target.removeEventListener(event, handler, finalOptions);
  } catch (err) {
    sharedLogger.warn('addListener: failed to add listener', err);
    return () => {};
  }
}

export function onResize(callback, delay = 100) {
  if (typeof window === 'undefined') return () => {};

  const debouncedCallback = debounce(callback, delay);
  return addListener(window, 'resize', debouncedCallback);
}

export class SectionTracker {
  constructor() {
    this.sections = [];
    this.sectionRatios = new Map();
    this.currentSectionId = null;
    this.observer = null;
    this.log = createLogger('SectionTracker');
  }

  init() {
    if (document.readyState === 'loading') {
      document.addEventListener(
        'DOMContentLoaded',
        () => this.setupObserver(),
        { once: true },
      );
    } else {
      setTimeout(() => this.setupObserver(), 100);
    }

    document.addEventListener('section:loaded', () => {
      setTimeout(() => this.refreshSections(), 50);
    });

    document.addEventListener('footer:loaded', () => {
      setTimeout(() => this.refreshSections(), 50);
    });
  }

  setupObserver() {
    this.refreshSections();

    if (!window.IntersectionObserver) {
      this.log.warn('IntersectionObserver unavailable');
      return;
    }

    if (this.sections.length === 0) {
      this.log.debug('No sections found to track yet');
      return;
    }

    this.observer = new IntersectionObserver(
      (entries) => this.handleIntersections(entries),
      OBSERVER_CONFIGS.sectionTracking,
    );

    this.sections.forEach((section) => {
      this.observer.observe(section);
    });

    this.checkInitialSection();
  }

  refreshSections() {
    this.sections = Array.from(
      document.querySelectorAll('main .section[id], footer#site-footer[id]'),
    ).filter((section) => section.id);

    if (this.observer) {
      this.sections.forEach((section) => {
        this.observer.observe(section);
      });
    }

    this.log.debug(`Tracking ${this.sections.length} sections`);
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
    this.sectionRatios.clear();
    this.currentSectionId = null;
  }
}
