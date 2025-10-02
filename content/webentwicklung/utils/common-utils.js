
/**
 * Common Utilities - Geteilte Funktionen für das gesamte Projekt
 * 
 * Zentrale Sammlung allgemeiner Hilfsfunktionen:
 * - Timing: throttle, debounce
 * - Array: shuffle
 * - DOM: getElementById mit Caching
 * - Timer: TimerManager für systematisches Cleanup
 * - Math: randomInt, randomFloat
 * 
 * @author Portfolio System
 * @version 1.0.0
 * @created 2025-10-02
 */

// Gemeinsame Utility-Funktionen für das gesamte Projekt

/**
 * Throttling-Funktion: Begrenzt Ausführung auf maximal einmal pro Zeitintervall
 * @param {Function} func - Zu throttelnde Funktion
 * @param {number} limit - Zeitintervall in ms (default: 250)
 * @returns {Function} Gethrottelte Funktion
 */
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

/**
 * Debouncing-Funktion: Verzögert Ausführung bis nach Ruhephase
 * @param {Function} fn - Zu debouncende Funktion
 * @param {number} wait - Wartezeit in ms (default: 100)
 * @returns {Function} Gedebouncete Funktion
 */
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
/**
 * Optimierte getElementById mit optionalem Caching
 * @param {string} id - Element-ID
 * @param {boolean} useCache - Cache verwenden (default: true)
 * @returns {Element|null} Gefundenes Element oder null
 */
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
  
  /**
   * Promise-basierter sleep mit automatischem Cleanup
   * @param {number} ms - Millisekunden zu warten
   * @returns {Promise<void>}
   */
  sleep(ms) {
    return new Promise((resolve) => {
      this.setTimeout(resolve, ms);
    });
  }
  
  /**
   * Timeout Promise mit automatischem Cleanup
   * @param {Function} callback - Callback Funktion
   * @param {number} delay - Verzögerung in ms
   * @returns {Promise<any>}
   */
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
  
  /**
   * Gibt die Anzahl aktiver Timer zurück
   */
  get activeCount() {
    return this.timers.size + this.intervals.size;
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
