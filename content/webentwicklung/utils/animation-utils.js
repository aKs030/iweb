/**
 * Animation Utilities - Enhanced Animation Engine Integration
 *
 * Zentrale Utility-Funktionen für:
 * - Animation Engine Scan-Trigger
 * - Element-Animation mit Optionen
 * - Container-Animation (animateContainerStagger)
 * - Performance-optimierte Animation-Workflows
 *
 * @author Portfolio System
 * @version 1.0.0
 * @created 2025-10-02
 */

// Animation Utilities
import { TimerManager } from "./common-utils.js";
import { createLogger } from "./logger.js";

const log = createLogger("AnimationUtils");
const animationTimers = new TimerManager();

/**
 * Triggert einen Re-scan der Enhanced Animation Engine
 * Gemeinsamer Helper für alle Module, die Animationen nutzen
 * @param {string} context - Kontext für Debugging (optional)
 */
export function triggerAnimationScan(context = "generic") {
  if (window.enhancedAnimationEngine?.scan) {
    window.enhancedAnimationEngine.scan();
    log.debug(`Animation scan getriggert (${context})`);
  }
}

/**
 * Triggert Animationen für alle Elemente in einem Container
 * @param {HTMLElement} container - Container mit animierbaren Elementen
 * @param {Object} options - Animation-Optionen
 */
export function animateElementsIn(container, options = { force: true }) {
  if (!container) return;

  if (window.enhancedAnimationEngine?.animateElementsIn) {
    window.enhancedAnimationEngine.animateElementsIn(container, options);
  }

  log.debug("Container-Elemente animiert", {
    container: container?.tagName,
    options,
  });
}

/**
 * Setzt alle Animationen in einem Container zurück
 * @param {HTMLElement} container - Container mit animierbaren Elementen
 */
export function resetElementsIn(container) {
  if (!container) return;

  if (window.enhancedAnimationEngine?.resetElementsIn) {
    window.enhancedAnimationEngine.resetElementsIn(container);
  } else {
    // Fallback für manuelle Reset-Logik
    const elements = container.querySelectorAll(
      "[data-animation], [data-animate], .animate-in"
    );
    elements.forEach((el) => {
      el.classList.remove("animate-in", "is-visible");
    });
  }

  log.debug("Container-Animationen zurückgesetzt", {
    container: container?.tagName,
  });
}

/**
 * Wartet auf Animation Engine und führt Callback aus
 * @param {Function} callback - Callback nach Engine-Bereitschaft
 * @param {number} maxAttempts - Maximale Versuche (default: 50)
 * @param {number} delay - Verzögerung zwischen Versuchen in ms (default: 100)
 */
export function waitForAnimationEngine(
  callback,
  maxAttempts = 50,
  delay = 100
) {
  let attempts = 0;

  const checkEngine = () => {
    if (
      window.enhancedAnimationEngine &&
      typeof window.enhancedAnimationEngine.scan === "function"
    ) {
      callback();
      return;
    }

    attempts++;
    if (attempts < maxAttempts) {
      animationTimers.setTimeout(checkEngine, delay);
    } else {
      log.warn(
        `Animation Engine nicht verfügbar nach ${maxAttempts} Versuchen`
      );
    }
  };

  checkEngine();
}

/**
 * Scheduled Animation Scan mit Verzögerung
 * @param {number} delay - Verzögerung in ms (default: 120)
 * @param {string} context - Kontext für Debugging
 */
export function scheduleAnimationScan(delay = 120, context = "scheduled") {
  animationTimers.setTimeout(() => {
    triggerAnimationScan(context);
  }, delay);
}

/**
 * Fallback Animation Engine für Situationen ohne echte Engine
 * Bietet minimale API-Kompatibilität
 */
export function createFallbackAnimationEngine() {
  return {
    scan() {
      log.debug("Fallback: Animation scan");
      return true;
    },

    setRepeatOnScroll(enabled) {
      log.debug("Fallback: setRepeatOnScroll", enabled);
      return true;
    },

    resetElementsIn(container) {
      if (!container) return;
      const elements = container.querySelectorAll(
        "[data-animation], [data-animate]"
      );
      elements.forEach((el) => {
        el.classList.remove("animate-in", "is-visible");
      });
      log.debug("Fallback: resetElementsIn", container.tagName);
    },

    animateElementsIn(container) {
      if (!container) return;
      const elements = container.querySelectorAll(
        "[data-animation], [data-animate]"
      );
      elements.forEach((el, index) => {
        animationTimers.setTimeout(
          () => el.classList.add("animate-in", "is-visible"),
          index * 100
        );
      });
      log.debug("Fallback: animateElementsIn", container.tagName);
    },
  };
}

/**
 * Setze Fallback Engine wenn keine echte verfügbar ist
 * @param {boolean} force - Überschreibe bestehende Engine
 */
export function ensureFallbackAnimationEngine(force = false) {
  if (!window.enhancedAnimationEngine || force) {
    window.enhancedAnimationEngine = createFallbackAnimationEngine();
    log.debug("Fallback Animation Engine gesetzt");
  }
}
