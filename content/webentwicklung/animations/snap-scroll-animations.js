/**
 * Snap Scroll Card & Header Animations
 * Ausgelagert aus main.js für bessere Wartbarkeit & geringere kognitive Komplexität.
 * Beobachtet Abschnitte mit Karten ('.features-cards') und animiert:
 *  - Header (leichtes Hereingleiten)
 *  - Karten (stagger via animateContainerStagger)
 *
 * Features:
 *  - Debounced Rescan für dynamisch nachgeladene Sections
 *  - WeakSet um doppelte Animation zu verhindern
 *  - prefers-reduced-motion Respekt
 *  - Optional Singleton Zugriff via getSnapScrollInstance()
 */
import { prefersReducedMotion } from '../utils/common-utils.js';
import { createLogger } from '../utils/logger.js';
import { animateContainerStagger } from './card-animation-utils.js';

const log = createLogger('snap-scroll');

const REDUCED_MOTION = prefersReducedMotion();

const CONFIG = {
  threshold: 0.3,
  rootMargin: '-10% 0px -10% 0px',
  staggerDelay: 150,
  cardDuration: 600,
  rescanDebounce: 120
};

/**
 * Einfache Debounce Implementierung (Timeout basiert)
 * @param {Function} fn - Funktion die verzögert ausgeführt werden soll
 * @param {number} [wait=100] - Wartezeit in ms
 * @returns {Function}
 */
function debounce(fn, wait = 100) {
  let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
}

/**
 * Animiert alle Karten in einem Container mittels Utility Stagger Funktion
 * @param {HTMLElement} container
 */
function animateCards(container) {
  animateContainerStagger(container, {
    selector: '.card',
    stagger: CONFIG.staggerDelay,
    duration: CONFIG.cardDuration,
    initialTranslate: 30,
    scaleFrom: 0.9
  });
}

/**
 * Simpler Translate/Fade Header Effekt
 * @param {HTMLElement} header
 */
function animateHeader(header) {
  if (REDUCED_MOTION) return;
  header.style.transform = 'translateY(-20px)';
  header.style.opacity = '0';
  header.style.transition = '';
  requestAnimationFrame(() => {
    header.style.transition = 'transform 500ms cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 500ms ease-out';
    header.style.transform = 'translateY(0)';
    header.style.opacity = '1';
  });
}

/**
 * Klasse kapselt die Scroll- / Intersection-basierten Animationen für Karten-Abschnitte.
 */
export class SnapScrollAnimations {
  constructor() {
    this.observer = null;
    this.animatedSections = new WeakSet();
    this._debouncedRescan = debounce(() => this._rescanInternal(), CONFIG.rescanDebounce);
  }

  /**
   * IntersectionObserver Callback
   * @param {IntersectionObserverEntry[]} entries
   */
  handleIntersection(entries) {
    entries.forEach(entry => {
      const section = entry.target;
      if (entry.isIntersecting && entry.intersectionRatio >= CONFIG.threshold) {
        if (this.animatedSections.has(section)) return;
        this.animatedSections.add(section);
        log.debug('snap-scroll trigger', { id: section.id });
        const header = section.querySelector('.section-header');
        if (header) animateHeader(header);
        const cardsContainer = section.querySelector('.features-cards');
        if (cardsContainer) setTimeout(() => animateCards(cardsContainer), 200);
        const title = section.querySelector('.section-title')?.textContent || 'Section';
        if (window.announce) window.announce(`${title} Abschnitt animiert`);
      }
    });
  }

  /**
   * Initialisiert Observer & registriert relevante Sections
   */
  init() {
    if (this.observer) return;
    this.observer = new IntersectionObserver(e => this.handleIntersection(e), {
      threshold: [0, CONFIG.threshold, 0.5, 1],
      rootMargin: CONFIG.rootMargin
    });
    const sections = document.querySelectorAll('.full-screen-section, [data-scroll-animate]');
    sections.forEach(section => {
      if (section.querySelector('.features-cards')) {
        this.observer.observe(section);
        log.debug('observing section', { id: section.id || 'unnamed' });
      }
    });
  }

  /**
   * Public API um nach dynamischem DOM Load neue Sections aufzunehmen
   */
  rescan() {
    if (!this.observer) return;
    this._debouncedRescan();
  }

  /**
   * Interner Rescan (debounced) – fügt neue noch nicht animierte Sections dem Observer hinzu
   */
  _rescanInternal() {
    if (!this.observer) return;
    const sections = document.querySelectorAll('.full-screen-section, [data-scroll-animate]');
    let added = 0;
    sections.forEach(section => {
      if (section.querySelector('.features-cards') && !this.animatedSections.has(section)) {
        this.observer.observe(section);
        added++;
        log.debug('rescan added', { id: section.id || 'unnamed' });
      }
    });
    if (added) log.debug('rescan complete', { added });
  }

  /**
   * Observer freigeben & internen Zustand zurücksetzen
   */
  cleanup() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
      this.animatedSections = new WeakSet();
      log.debug('cleanup done');
    }
  }
}

// Optional Singleton Helper
/**
 * Liefert Singleton Instanz (wird lazily erstellt)
 * @returns {SnapScrollAnimations}
 */
export function getSnapScrollInstance() {
  if (!window.__snapScroll) window.__snapScroll = new SnapScrollAnimations();
  return window.__snapScroll;
}

export default getSnapScrollInstance;