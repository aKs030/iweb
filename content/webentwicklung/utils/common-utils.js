// ===== Gemeinsame Utility-Funktionen =====
// Zentrale Sammlung aller wiederverwendbaren Funktionen

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

// ===== Array Utilities =====
export function shuffle(array) {
  const arr = [...array]; // Kopie erstellen
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(randomFloat(0, i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ===== DOM Utilities - Optimiert =====
const elementCache = new Map();
const CACHE_MAX_SIZE = 50; // Limit für Cache-Größe

export function getElementById(id, useCache = true) {
  if (useCache && elementCache.has(id)) {
    const cached = elementCache.get(id);
    // Prüfen ob Element noch im DOM ist
    if (cached && document.contains(cached)) {
      return cached;
    }
    elementCache.delete(id);
  }
  
  const element = document.getElementById(id);
  if (useCache && element) {
    // Cache-Limit prüfen
    if (elementCache.size >= CACHE_MAX_SIZE) {
      // Ältestes Element entfernen (LRU-artig)
      const firstKey = elementCache.keys().next().value;
      elementCache.delete(firstKey);
    }
    elementCache.set(id, element);
  }
  return element;
}

// ===== Accessibility & UX Utilities =====
let reducedMotionCache = null;

export function prefersReducedMotion() {
  if (reducedMotionCache === null) {
    try {
      const saved = localStorage.getItem('pref-reduce-motion');
      reducedMotionCache = saved === '1' || 
        (saved === null && matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch {
      reducedMotionCache = matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
  }
  return reducedMotionCache;
}

// ===== Timer Utilities =====
export class TimerManager {
  constructor() {
    this.timers = new Set();
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
  
  clearAll() {
    for (const timer of this.timers) {
      clearTimeout(timer);
    }
    this.timers.clear();
  }
}

// ===== Math Utilities - Vereinfacht =====
export function clamp(value, min, max) {
  return Math.max(min, Math.min(value, max));
}

export function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function randomFloat(min, max) {
  return Math.random() * (max - min) + min;
}

// ===== Export für Legacy-Kompatibilität =====
export default {
  throttle,
  shuffle,
  getElementById,
  prefersReducedMotion,
  TimerManager,
  clamp,
  randomInt,
  randomFloat
};
