// animation-utils.js
// Gemeinsame Hilfsfunktionen für Animationsmodule

/**
 * Debounce-Funktion: Führt fn erst nach Ablauf von wait ms aus, wenn keine weiteren Aufrufe erfolgen.
 * @param {Function} fn
 * @param {number} wait
 * @returns {Function}
 */
export function debounce(fn, wait = 100) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn.apply(this, args), wait);
  };
}

/**
 * Prüft, ob der Nutzer reduzierte Bewegungen bevorzugt.
 * @returns {boolean}
 */
export function isReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * TimerManager für Animation-Cleanup
 */
export class TimerManager {
  constructor() {
    this.timers = new Set();
  }
  set(fn, delay) {
    const id = setTimeout(fn, delay);
    this.timers.add(id);
    return id;
  }
  clear(id) {
    clearTimeout(id);
    this.timers.delete(id);
  }
  clearAll() {
    this.timers.forEach(clearTimeout);
    this.timers.clear();
  }
}

/**
 * Erstellt und verwaltet ein WeakSet für bereits animierte Elemente
 */
export function createAnimatedSet() {
  return new WeakSet();
}
