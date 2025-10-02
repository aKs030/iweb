/**
 * Shared Particle System - Gemeinsame Infrastruktur für Three.js Earth System
 *
 * Zentralisiert gemeinsame Funktionalitäten für Particle-Systeme:
 * - Parallax-Scroll-Management mit synchronen Effekten
 * - Resource-Cleanup-Management
 * - Performance-optimiertes State-Management
 *
 * @author Portfolio System
 * @version 1.0.0
 * @created 2025-10-02
 */

// Shared Particle System - Gemeinsame Infrastruktur für Three.js Earth System
import { throttle } from "../utils/common-utils.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("sharedParticleSystem");

// ===== Shared Configuration =====
export const SHARED_CONFIG = {
  PERFORMANCE: {
    THROTTLE_MS: 16, // 60fps
    SECTION_TRANSITION_MS: 800,
  },
  SCROLL: {
    PARALLAX_SPEED: 0.05,
    CSS_PROPERTY_PREFIX: "--scroll-",
  },
  SECTIONS: ["hero", "about", "projects", "contact"],
};

// ===== Shared State Management =====
class SharedParticleState {
  constructor() {
    this.isInitialized = false;
    this.currentSection = "hero";
    this.isScrollListenerActive = false;
    this.cleanupFunctions = [];
    this.systems = new Map(); // Registrierte Systeme

    // Scroll & Parallax
    this.scrollProgress = 0;
    this.parallaxHandler = null;

    // Section Detection
    this.sectionObserver = null;

    // Animation
    this.animationFrameId = null;

    // Timeouts
    this.timeouts = {
      active: [],
      shootingStar: null,
    };
  }

  reset() {
    this.cleanupFunctions = [];
    this.systems.clear();
    this.isInitialized = false;
    this.currentSection = "hero";
    this.scrollProgress = 0;
    this.isScrollListenerActive = false;
    this.parallaxHandler = null;
    this.sectionObserver = null;
    this.animationFrameId = null;
    this.timeouts = { active: [], shootingStar: null };
  }

  registerSystem(name, systemInstance) {
    this.systems.set(name, systemInstance);
    log.debug(`System registered: ${name}`);
  }

  unregisterSystem(name) {
    this.systems.delete(name);
    log.debug(`System unregistered: ${name}`);
  }

  getSystems() {
    return Array.from(this.systems.values());
  }
}

// ===== Singleton State Instance =====
const sharedState = new SharedParticleState();

/**
 * Berechnet den aktuellen Scroll-Progress als Wert zwischen 0 und 1
 * @returns {number} Scroll-Progress (0-1)
 */
export function calculateScrollProgress() {
  const scrollY = window.pageYOffset;
  const windowHeight = window.innerHeight;
  const documentHeight = document.documentElement.scrollHeight;

  return Math.min(
    1,
    Math.max(0, scrollY / Math.max(1, documentHeight - windowHeight))
  );
}

/**
 * Zentraler Parallax Manager für synchrone Scroll-Effekte
 * Koordiniert mehrere Parallax-Handler mit einheitlichem throttling
 */
export class SharedParallaxManager {
  constructor() {
    this.isActive = false;
    this.handlers = new Set();
  }

  addHandler(handler, name = "anonymous") {
    this.handlers.add({ handler, name });
    log.debug(`Parallax handler added: ${name}`);

    if (!this.isActive) {
      this.activate();
    }
  }

  removeHandler(handler) {
    const handlerObj = Array.from(this.handlers).find(
      (h) => h.handler === handler
    );
    if (handlerObj) {
      this.handlers.delete(handlerObj);
      log.debug(`Parallax handler removed: ${handlerObj.name}`);
    }

    if (this.handlers.size === 0) {
      this.deactivate();
    }
  }

  activate() {
    if (this.isActive) return;

    const throttledHandler = throttle(() => {
      try {
        const progress = calculateScrollProgress();
        sharedState.scrollProgress = progress;

        // CSS Custom Properties setzen
        document.documentElement.style.setProperty(
          `${SHARED_CONFIG.SCROLL.CSS_PROPERTY_PREFIX}progress`,
          progress
        );
        document.documentElement.style.setProperty(
          "--global-scroll-progress",
          progress
        );
        document.documentElement.style.setProperty(
          "--star-scroll-progress",
          progress
        );

        // Alle Handler aufrufen
        this.handlers.forEach(({ handler, name }) => {
          try {
            handler(progress, window.pageYOffset);
          } catch (error) {
            log.error(`Parallax handler error (${name}):`, error);
          }
        });
      } catch (error) {
        log.error("Shared parallax error:", error);
      }
    }, SHARED_CONFIG.PERFORMANCE.THROTTLE_MS);

    sharedState.parallaxHandler = throttledHandler;
    window.addEventListener("scroll", throttledHandler, { passive: true });
    sharedState.isScrollListenerActive = true;
    this.isActive = true;

    // Initial call
    throttledHandler();

    log.debug("Shared parallax system activated");
  }

  deactivate() {
    if (!this.isActive) return;

    if (sharedState.parallaxHandler) {
      window.removeEventListener("scroll", sharedState.parallaxHandler);
      sharedState.parallaxHandler = null;
    }

    sharedState.isScrollListenerActive = false;
    this.isActive = false;
    this.handlers.clear();

    log.debug("Shared parallax system deactivated");
  }
}

// ===== Shared Cleanup Manager =====
export class SharedCleanupManager {
  constructor() {
    this.cleanupFunctions = new Map(); // system name -> cleanup functions
  }

  addCleanupFunction(systemName, cleanupFn, description = "anonymous") {
    if (!this.cleanupFunctions.has(systemName)) {
      this.cleanupFunctions.set(systemName, []);
    }

    this.cleanupFunctions.get(systemName).push({ fn: cleanupFn, description });
    log.debug(`Cleanup function added for ${systemName}: ${description}`);
  }

  cleanupSystem(systemName) {
    const systemCleanups = this.cleanupFunctions.get(systemName);
    if (!systemCleanups) return;

    systemCleanups.forEach(({ fn, description }) => {
      try {
        fn();
        log.debug(`Cleanup executed for ${systemName}: ${description}`);
      } catch (error) {
        log.error(`Cleanup error for ${systemName} (${description}):`, error);
      }
    });

    this.cleanupFunctions.delete(systemName);
    log.debug(`System cleanup completed: ${systemName}`);
  }

  cleanupAll() {
    log.info("Starting global cleanup");

    // Animation frame cleanup
    if (sharedState.animationFrameId) {
      cancelAnimationFrame(sharedState.animationFrameId);
      sharedState.animationFrameId = null;
    }

    // Timeouts cleanup
    if (sharedState.timeouts.shootingStar) {
      clearTimeout(sharedState.timeouts.shootingStar);
    }
    sharedState.timeouts.active.forEach((timeout) => clearTimeout(timeout));

    // System-spezifische Cleanups
    this.cleanupFunctions.forEach((cleanups, systemName) => {
      this.cleanupSystem(systemName);
    });

    // Shared systems cleanup
    sharedParallaxManager.deactivate();

    // State reset
    sharedState.reset();

    log.info("Global cleanup completed");
  }
}

// ===== Singleton Instances =====
export const sharedParallaxManager = new SharedParallaxManager();
export const sharedCleanupManager = new SharedCleanupManager();

// ===== Public API =====
export function getSharedState() {
  return sharedState;
}

export function registerParticleSystem(name, systemInstance) {
  sharedState.registerSystem(name, systemInstance);
}

export function unregisterParticleSystem(name) {
  sharedState.unregisterSystem(name);
}
