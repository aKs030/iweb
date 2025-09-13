// animation-utils.js
// Animations-spezifische Hilfsfunktionen

/**
 * Prüft, ob der Nutzer reduzierte Bewegungen bevorzugt.
 * @returns {boolean}
 */
export function isReducedMotion() {
  return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}