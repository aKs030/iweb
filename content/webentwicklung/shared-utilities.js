/**
 * Shared Utilities - Zentrale, oft verwendete Funktionen
 *
 * Diese Datei enthält die am häufigsten duplizierten Utility-Funktionen
 * um Code-Duplikation zu reduzieren ohne ein ganzes utils-Verzeichnis zu haben.
 *
 * @author Portfolio System
 * @version 1.0.0
 * @created 2025-10-02
 */

// ===== Logger System =====
const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

let globalLogLevel = LOG_LEVELS.warn;

export function setGlobalLogLevel(level) {
  if (level in LOG_LEVELS) {
    globalLogLevel = LOG_LEVELS[level];
  }
}

export function createLogger(category) {
  const prefix = `[${category}]`;

  const consoleRef = globalThis.console || {
    error: () => {},
    warn: () => {},
    info: () => {},
    debug: () => {},
  };

  const {
    error: logError,
    warn: logWarn,
    info: logInfo,
    debug: logDebug,
  } = consoleRef;

  return {
    error: (message, ...args) => {
      if (globalLogLevel >= LOG_LEVELS.error) {
        logError(prefix, message, ...args);
      }
    },
    warn: (message, ...args) => {
      if (globalLogLevel >= LOG_LEVELS.warn) {
        logWarn(prefix, message, ...args);
      }
    },
    info: (message, ...args) => {
      if (globalLogLevel >= LOG_LEVELS.info) {
        logInfo(prefix, message, ...args);
      }
    },
    debug: (message, ...args) => {
      if (globalLogLevel >= LOG_LEVELS.debug) {
        logDebug(prefix, message, ...args);
      }
    },
  };
}

const sharedLogger = createLogger("SharedUtilities");

// Debug-Modus basierend auf URL-Parameter oder localStorage
if (typeof window !== "undefined") {
  const urlParams = new URLSearchParams(window.location.search);
  const debugParam = urlParams.get("debug");
  const debugStorage = window.localStorage?.getItem("iweb-debug");

  if (debugParam === "true" || debugStorage === "true") {
    setGlobalLogLevel("debug");
  }
}

// ===== DOM Utilities =====
const elementCache = new Map();
const CACHE_MAX_SIZE = 20;

export function getElementById(id, useCache = true) {
  if (useCache && elementCache.has(id)) {
    const cached = elementCache.get(id);
    if (cached && document.contains(cached)) return cached;
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
  let inThrottle;
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
    for (const timer of this.timers) clearTimeout(timer);
    for (const interval of this.intervals) clearInterval(interval);
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
  HERO_LOADED: "hero:loaded",
  HERO_TYPING_END: "hero:typingEnd",
  FEATURES_TEMPLATES_LOADED: "featuresTemplatesLoaded",
  FEATURES_TEMPLATES_ERROR: "featuresTemplatesError",
  TEMPLATE_MOUNTED: "template:mounted",
  FEATURES_CHANGE: "features:change",

  // Neue Events für koordinierte Initialisierung
  DOM_READY: "app:domReady",
  CORE_INITIALIZED: "app:coreInitialized",
  MODULES_READY: "app:modulesReady",
  HERO_INIT_READY: "app:heroInitReady",
});

export function fire(type, detail, target = document) {
  try {
    if (!target || typeof target.dispatchEvent !== "function") {
      return;
    }
    target.dispatchEvent(new CustomEvent(type, { detail }));
  } catch (e) {
    console.warn('Failed to dispatch event:', type, e);
  }
}

export function on(type, handler, options, target = document) {
  let realTarget = target,
    opts = options;
  if (
    options &&
    typeof options.addEventListener !== "function" &&
    typeof target.addEventListener !== "function"
  ) {
    opts = options;
    realTarget = document;
  } else if (options && typeof options.addEventListener === "function") {
    realTarget = options;
    opts = undefined;
  }
  if (!realTarget || typeof realTarget.addEventListener !== "function") {
    return () => {};
  }
  realTarget.addEventListener(type, handler, opts);
  return () => realTarget.removeEventListener(type, handler, opts);
}

// ===== Event Management =====
export class EventListenerManager {
  constructor(name = "anonymous") {
    this.name = name;
    this.listeners = new Set();
    this.isDestroyed = false;
    this.log = createLogger(`EventListenerManager:${name}`);
  }

  add(target, event, handler, options = {}) {
    if (this.isDestroyed) {
      this.log.warn(
        `${this.name}: Versuch Listener zu ${event} hinzuzufügen nach destroy`
      );
      return () => {};
    }

    if (!target || typeof target.addEventListener !== "function") {
      this.log.warn(
        `${this.name}: Ungültiges Event Target für ${event}`,
        target
      );
      return () => {};
    }

    const normalizedOptions =
      typeof options === "boolean" ? { capture: options } : options;

    const finalOptions = {
      passive: true,
      ...normalizedOptions,
    };

    try {
      target.addEventListener(event, handler, finalOptions);

      const listenerInfo = { target, event, handler, options: finalOptions };
      this.listeners.add(listenerInfo);

      return () => this.remove(target, event, handler);
    } catch (error) {
      this.log.error(`Fehler beim Hinzufügen von ${event} Listener:`, error);
      return () => {};
    }
  }

  remove(target, event, handler) {
    const listenerToRemove = Array.from(this.listeners).find(
      (l) => l.target === target && l.event === event && l.handler === handler
    );

    if (listenerToRemove) {
      try {
        target.removeEventListener(event, handler, listenerToRemove.options);
        this.listeners.delete(listenerToRemove);
      } catch (error) {
        this.log.warn(`Fehler beim Entfernen von ${event} Listener:`, error);
      }
    }
  }

  removeAll() {
    this.listeners.forEach(({ target, event, handler, options }) => {
      try {
        target.removeEventListener(event, handler, options);
      } catch (error) {
        this.log.warn(`Cleanup Fehler für ${event}:`, error);
      }
    });

    this.listeners.clear();
  }

  destroy() {
    this.removeAll();
    this.isDestroyed = true;
  }

  get size() {
    return this.listeners.size;
  }
}

export function createEventManager(name = "manager", autoCleanup = true) {
  const manager = new EventListenerManager(name);

  if (autoCleanup && typeof window !== "undefined") {
    window.addEventListener(
      "beforeunload",
      () => {
        manager.destroy();
      },
      { once: true }
    );
  }

  return manager;
}

export function onVisibilityChange(callback) {
  if (typeof document === "undefined") return () => {};

  const handler = () => callback(!document.hidden);
  try {
    document.addEventListener("visibilitychange", handler, { passive: true });
    return () => document.removeEventListener("visibilitychange", handler);
  } catch (error) {
    sharedLogger.error("onVisibilityChange: Event Setup Fehler:", error);
    return () => {};
  }
}

// ===== Intersection Observer Utilities =====
export function createLazyLoadObserver(
  callback,
  options = {
    threshold: 0.15,
    rootMargin: "120px 0px",
  }
) {
  if (!window.IntersectionObserver) {
    sharedLogger.warn("IntersectionObserver nicht verfügbar - Fallback aktiv");
    return {
      observer: null,
      observe: (element) => callback(element),
      disconnect: () => {},
    };
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        observer.unobserve(entry.target);
        callback(entry.target);
      }
    });
  }, options);

  return {
    observer,
    observe: (element) => observer.observe(element),
    disconnect: () => observer.disconnect(),
  };
}

// ===== Persistent Storage Utilities =====
let _persistPromise = null;
export async function ensurePersistentStorage() {
  if (_persistPromise) return _persistPromise;
  _persistPromise = (async () => {
    if (!("storage" in navigator)) {
      return { supported: false, persisted: false };
    }
    const storage = navigator.storage;
    let persisted = false;
    try {
      if ("persisted" in storage) {
        persisted = await storage.persisted().catch(() => false);
      }
      if (!persisted && "persist" in storage) {
        persisted = await storage.persist().catch(() => false);
      }
      let quota = null;
      if ("estimate" in storage) {
        const est = await storage.estimate().catch(() => null);
        if (est) {
          quota = {
            quota: est.quota,
            usage: est.usage,
            usageDetails: est.usageDetails || undefined,
          };
        }
      }
      return { supported: true, persisted, quota };
    } catch {
      return { supported: false, persisted: false };
    }
  })();
  return _persistPromise;
}

export function schedulePersistentStorageRequest(delay = 2500) {
  try {
    setTimeout(() => {
      ensurePersistentStorage().catch(() => {});
    }, delay);
  } catch {
    /* ignore */
  }
}

// ===== Math Utilities =====
export function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ===== Animation Utilities (entfernt) =====
// Animation-System wurde vollständig aus dem Projekt entfernt

// ===== Event Management =====
export function addListener(target, event, handler, options = {}) {
  if (!target || typeof target.addEventListener !== "function") {
    return () => {};
  }

  const finalOptions = { passive: true, ...options };

  try {
    target.addEventListener(event, handler, finalOptions);
    return () => target.removeEventListener(event, handler, finalOptions);
  } catch {
    return () => {};
  }
}

export function onResize(callback, delay = 100) {
  if (typeof window === "undefined") return () => {};

  let timeoutId;
  const debouncedHandler = () => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(callback, delay);
  };

  const cleanup = addListener(window, "resize", debouncedHandler, {
    passive: true,
  });

  return () => {
    clearTimeout(timeoutId);
    cleanup();
  };
}

export function onScroll(callback, target = window, throttleMs = 16) {
  let lastCall = 0;

  const throttledHandler = () => {
    const now = Date.now();
    if (now - lastCall >= throttleMs) {
      lastCall = now;
      callback();
    }
  };

  return addListener(target, "scroll", throttledHandler, { passive: true });
}

export function setupPointerEvents(
  element,
  { onStart, onMove, onEnd },
  options = {}
) {
  const listeners = new Set();

  const handlePointerDown = (e) => {
    if (onStart) onStart(e);
  };

  const handlePointerMove = (e) => {
    if (onMove) onMove(e);
  };

  const handlePointerUp = (e) => {
    if (onEnd) onEnd(e);
  };

  // Mouse Events
  listeners.add(
    addListener(element, "mousedown", handlePointerDown, {
      passive: false,
      ...options,
    })
  );
  listeners.add(
    addListener(element, "mousemove", handlePointerMove, {
      passive: true,
      ...options,
    })
  );
  listeners.add(
    addListener(element, "mouseup", handlePointerUp, {
      passive: true,
      ...options,
    })
  );
  listeners.add(
    addListener(element, "mouseleave", handlePointerUp, {
      passive: true,
      ...options,
    })
  );

  // Touch Events
  listeners.add(
    addListener(element, "touchstart", handlePointerDown, {
      passive: false,
      ...options,
    })
  );
  listeners.add(
    addListener(element, "touchmove", handlePointerMove, {
      passive: true,
      ...options,
    })
  );
  listeners.add(
    addListener(element, "touchend", handlePointerUp, {
      passive: true,
      ...options,
    })
  );
  listeners.add(
    addListener(element, "touchcancel", handlePointerUp, {
      passive: true,
      ...options,
    })
  );

  return () => {
    listeners.forEach((cleanup) => cleanup());
    listeners.clear();
  };
}

// ===== Intersection Observer Utilities =====

export const OBSERVER_CONFIGS = {
  heroLoading: {
    threshold: 0,
    rootMargin: "0px",
  },
  sectionTracking: {
    threshold: [0.1, 0.3, 0.5, 0.7],
    rootMargin: "-10% 0px -10% 0px",
  },
};

export function createTriggerOnceObserver(
  callback,
  options = OBSERVER_CONFIGS.heroLoading
) {
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

// ===== Section Tracker =====

export class SectionTracker {
  constructor() {
    this.sections = [];
    this.currentSectionId = null;
    this.observer = null;
  }

  init() {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => this.setupObserver());
    } else {
      setTimeout(() => this.setupObserver(), 100);
    }

    document.addEventListener("section:loaded", () => {
      setTimeout(() => this.refreshSections(), 50);
    });
  }

  setupObserver() {
    this.refreshSections();

    if (!("IntersectionObserver" in window) || this.sections.length === 0) {
      return;
    }

    this.observer = new IntersectionObserver((entries) => {
      this.handleIntersections(entries);
    }, OBSERVER_CONFIGS.sectionTracking);

    this.sections.forEach((section) => {
      this.observer.observe(section);
    });

    this.checkInitialSection();
  }

  refreshSections() {
    this.sections = Array.from(
      document.querySelectorAll("main .section, .section")
    ).filter((section) => section.id);

    if (this.observer) {
      this.sections.forEach((section) => {
        this.observer.observe(section);
      });
    }
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
      const detail = {
        id: sectionId,
        index: sectionIndex,
        section: getElementById(sectionId),
      };

      const event = new CustomEvent("snapSectionChange", { detail });
      window.dispatchEvent(event);
    } catch {
      // Fail silently
    }
  }

  updateCurrentSection(sectionId) {
    if (this.sections.find((s) => s.id === sectionId)) {
      this.currentSectionId = sectionId;
      this.dispatchSectionChange(sectionId);
    }
  }
}
