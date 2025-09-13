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
import { prefersReducedMotion } from '../utils/common-utils.js';
export function isReducedMotion() {
  return prefersReducedMotion();
}