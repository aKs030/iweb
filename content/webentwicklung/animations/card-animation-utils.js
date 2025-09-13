/**
 * Gemeinsame Utility-Funktionen für Karten-Einblend-Animationen.
 * Ziel: zentrales, wiederverwendbares Stagger & Entrance Verhalten für Kartensammlungen.
 * Verwendet von SnapScroll und kann zukünftig von anderen Sektionen genutzt werden.
 *
 * Performance / Accessibility:
 *  - Achtet auf "prefers-reduced-motion" und überspringt dann Transition Effekte
 *  - Fügt am Ende die Klasse 'scroll-animated' hinzu um erneutes Triggern zu vermeiden
 */

import { prefersReducedMotion } from '../utils/common-utils.js';

const REDUCED = prefersReducedMotion();

/**
 * Führt eine einzelne Karten-Einblendung (Translate + Scale + Fade) aus.
 * Setzt initiale Transform/Opacity ohne Transition, aktiviert dann Transition Frame-später.
 * Bei reduzierte Bewegung wird sofort Endzustand gesetzt.
 * @param {HTMLElement} card - Die Karten-Node die animiert werden soll
 * @param {Object} [options]
 * @param {number} [options.translateY=30] - Start Y-Offset in px
 * @param {number} [options.scaleFrom=0.9] - Start Skalierung
 * @param {number} [options.duration=600] - Animationsdauer in ms
 * @param {string} [options.easing='cubic-bezier(0.25, 0.46, 0.45, 0.94)'] - CSS Easing Kurve
 * @param {number} [options.delay=0] - Verzögerung in ms
 */
export function animateCardEntrance(card, {
  translateY = 30,
  scaleFrom = 0.9,
  duration = 600,
  easing = 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
  delay = 0
} = {}) {
  if (REDUCED) {
    card.classList.add('scroll-animated');
    return;
  }
  card.style.transform = `translateY(${translateY}px) scale(${scaleFrom})`;
  card.style.opacity = '0';
  card.style.transition = '';
  setTimeout(() => {
    card.style.transition = `transform ${duration}ms ${easing}, opacity ${duration}ms ease-out`;
    card.style.transform = 'translateY(0) scale(1)';
    card.style.opacity = '1';
    setTimeout(() => card.classList.add('scroll-animated'), duration);
  }, delay);
}

/**
 * Staggered Animation aller Karten in einem Container. Nutzt intern animateCardEntrance.
 * Berechnet Gesamtdauer (letzte Verzögerung + Dauer) um Completion Callback auszuführen.
 * Bei reduced motion wird sofort abgeschlossen.
 * @param {HTMLElement} container - Container der die Karten enthält
 * @param {Object} [options]
 * @param {string} [options.selector='.card'] - Query Selector für Karten
 * @param {number} [options.stagger=150] - Verzögerungsschritte zwischen Karten (ms)
 * @param {number} [options.duration=600] - Einzeldauer (ms)
 * @param {string} [options.easing] - Easing Kurve (wird durch animateCardEntrance gesetzt)
 * @param {number} [options.initialTranslate=30] - Anfangs Y-Offset
 * @param {number} [options.scaleFrom=0.9] - Anfangsskalierung
 * @param {Function} [options.onComplete] - Callback nach Abschluss aller Karten
 */
export function animateContainerStagger(container, {
  selector = '.card',
  stagger = 150,
  duration = 600,
  easing = 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
  initialTranslate = 30,
  scaleFrom = 0.9,
  onComplete
} = {}) {
  const cards = container.querySelectorAll(selector);
  cards.forEach((card, index) => {
    animateCardEntrance(card, {
      translateY: initialTranslate,
      scaleFrom,
      duration,
      easing,
      delay: index * stagger
    });
  });
  if (REDUCED) {
    container.classList.add('animations-complete');
    onComplete?.();
    return;
  }
  const total = cards.length * stagger + duration;
  setTimeout(() => {
    container.classList.add('animations-complete');
    onComplete?.();
  }, total);
}

/**
 * Liefert gecachten prefers-reduced-motion Zustand (einmalig beim Modul-Load ermittelt).
 * @returns {boolean}
 */
export function isReducedMotion() { return REDUCED; }