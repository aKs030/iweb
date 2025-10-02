/**
 * IntersectionObserver Utilities - Shared Patterns & Configurations
 *
 * Bietet wiederverwendbare IntersectionObserver Patterns und Konfigurationen
 * für verschiedene Use Cases wie Lazy Loading, Animation Triggering, etc.
 *
 * @author Portfolio System
 * @version 1.0.0
 * @created 2025-10-02
 */

import { createLogger } from "./logger.js";

const log = createLogger("intersectionUtils");

// ===== Standard Configurations =====

/**
 * Standard Observer Options für verschiedene Use Cases
 */
export const OBSERVER_CONFIGS = {
  // Lazy Loading für Module/Sections - großzügiger Vorlauf
  lazyLoading: {
    threshold: 0.15,
    rootMargin: "120px 0px",
  },

  // Hero Loading - sofortige Reaktion
  heroLoading: {
    threshold: 0,
    rootMargin: "0px",
  },

  // Animation Triggering - flexible Konfiguration
  animationTrigger: {
    threshold: 0.1,
    rootMargin: "50px 0px",
  },

  // Feature Rotation - detaillierte Ratio-Überwachung
  featureRotation: {
    threshold: [0, 0.1, 0.25, 0.35, 0.5, 0.75, 1],
    rootMargin: "0px",
  },
};

// ===== Observer Factory Functions =====

/**
 * Erstellt einen "Load-Once" Observer für Lazy Loading
 * @param {Function} callback - Callback für intersecting elements (element) => void
 * @param {Object} options - Observer options (optional)
 * @returns {Object} { observer, observe, disconnect }
 */
export function createLazyLoadObserver(
  callback,
  options = OBSERVER_CONFIGS.lazyLoading
) {
  if (!window.IntersectionObserver) {
    log.warn("IntersectionObserver nicht verfügbar - Fallback aktiv");
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

/**
 * Erstellt einen "Trigger-Once" Observer für einmalige Events
 * @param {Function} callback - Callback für trigger event () => void
 * @param {Object} options - Observer options (optional)
 * @returns {Object} { observer, observe, disconnect }
 */
export function createTriggerOnceObserver(
  callback,
  options = OBSERVER_CONFIGS.heroLoading
) {
  if (!window.IntersectionObserver) {
    log.warn("IntersectionObserver nicht verfügbar - sofortiger Trigger");
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

// ===== Cleanup Utilities =====

/**
 * Sicherer Observer Cleanup mit Null-Check
 * @param {IntersectionObserver|null} observer - Observer zum cleanup
 */
export function safeDisconnect(observer) {
  if (observer) {
    try {
      observer.disconnect();
    } catch (error) {
      log.warn("Fehler beim Observer disconnect:", error);
    }
  }
}

/**
 * Sicheres Element unobserve mit Null-Check
 * @param {IntersectionObserver|null} observer - Observer instance
 * @param {Element} element - Element zum unobserve
 */
export function safeUnobserve(observer, element) {
  if (observer && element) {
    try {
      observer.unobserve(element);
    } catch (error) {
      log.warn("Fehler beim Element unobserve:", error);
    }
  }
}

// ===== Debugging Helpers =====


