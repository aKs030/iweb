
// Gemeinsame Utility-Funktionen für das gesamte Projekt

// --- Timing Utilities ---
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

export function debounce(fn, wait = 100) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn.apply(this, args), wait);
  };
}

// --- Array Utilities ---
export function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(randomFloat(0, i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// --- DOM Utilities (vereinfacht) ---
const elementCache = new Map();
const CACHE_MAX_SIZE = 20; // Reduziert von 50 auf 20
export function getElementById(id, useCache = true) {
  if (useCache && elementCache.has(id)) {
    const cached = elementCache.get(id);
    if (cached && document.contains(cached)) return cached;
    elementCache.delete(id);
  }
  const element = document.getElementById(id);
  if (useCache && element) {
    if (elementCache.size >= CACHE_MAX_SIZE) {
      // Einfaches FIFO statt komplexes Cache-Management
      const firstKey = elementCache.keys().next().value;
      elementCache.delete(firstKey);
    }
    elementCache.set(id, element);
  }
  return element;
}

// --- Timer Utilities ---
export class TimerManager {
  constructor() { this.timers = new Set(); }
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
    for (const timer of this.timers) clearTimeout(timer);
    this.timers.clear();
  }
}

// --- Math Utilities ---
export function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
export function randomFloat(min, max) {
  return Math.random() * (max - min) + min;
}

// --- Erweiterbar: Weitere Utilities können hier ergänzt werden ---
