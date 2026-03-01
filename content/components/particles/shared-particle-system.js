/**
 * Shared Particle System - Optimized Common Infrastructure
 * * OPTIMIZATIONS v2.2.0:
 * - ShootingStarManager moved to `three-earth-system.js`
 * - Simplified state management
 * - Improved cleanup flow
 * - Better error handling
 * - Reduced memory footprint
 *
 * OPTIMIZATIONS v2.3.0:
 * - Three.js loading via import map; compressed model support via core/model-loader.js
 * @version 2.5.0
 * @last-modified 2026-03-01
 */

import { createLogger } from '../../core/logger.js';
import { throttle } from '../../core/utils.js';

const log = createLogger('sharedParticleSystem');

// ===== Shared Configuration =====

const SHARED_CONFIG = {
  PERFORMANCE: {
    THROTTLE_MS: 20,
  },
  SCROLL: {
    CSS_PROPERTY_PREFIX: '--scroll-',
  },
};

// ===== Shared State Management =====

class SharedParticleState {
  constructor() {
    this.systems = new Map();
    this.isInitialized = false;
  }

  /**
   * @param {string} name
   * @param {any} instance
   */
  registerSystem(name, instance) {
    if (this.systems.has(name)) {
      log.warn(`System '${name}' already registered, overwriting`);
    }
    this.systems.set(name, instance);
  }

  /**
   * @param {string} name
   */
  unregisterSystem(name) {
    const deleted = this.systems.delete(name);
    if (deleted) {
      log.debug(`System '${name}' unregistered`);
    }
    return deleted;
  }

  /**
   * @param {string} name
   */
  hasSystem(name) {
    return this.systems.has(name);
  }

  reset() {
    this.systems.clear();
    this.isInitialized = false;
  }
}

const sharedState = new SharedParticleState();

/**
 * Get shared state instance
 * @returns {SharedParticleState}
 */
export function getSharedState() {
  return sharedState;
}

// ===== Parallax Manager =====

class SharedParallaxManager {
  constructor() {
    this.isActive = false;
    this.handlers = new Set();
    this.scrollHandler = null;
  }

  /**
   * @param {Function} handler
   * @param {string} name
   */
  addHandler(handler, name = 'anonymous') {
    if (typeof handler !== 'function') {
      log.error(`Invalid handler for '${name}', must be a function`);
      return;
    }

    this.handlers.add({ handler, name });

    if (!this.isActive) {
      this.activate();
    }
  }

  /**
   * @param {Function} handler
   */
  removeHandler(handler) {
    const handlerObj = Array.from(this.handlers).find(
      (h) => h.handler === handler,
    );
    if (handlerObj) {
      this.handlers.delete(handlerObj);
      log.debug(`Parallax handler '${handlerObj.name}' removed`);
    }

    if (this.handlers.size === 0) {
      this.deactivate();
    }
  }

  activate() {
    if (this.isActive) return;

    const root = document.documentElement;
    let lastProgress = -1;

    this.scrollHandler = /** @type {EventListener} */ (
      throttle(() => {
        const scrollY = window.pageYOffset;
        const windowHeight = window.innerHeight;
        const documentHeight = root.scrollHeight;
        const scrollableHeight = Math.max(1, documentHeight - windowHeight);
        const progress = Math.min(1, Math.max(0, scrollY / scrollableHeight));

        // Update CSS variable only if it changed significantly (0.1% precision)
        // This avoids expensive style/layout recalculations on every single pixel of scroll
        if (Math.abs(progress - lastProgress) > 0.001) {
          root.style.setProperty(
            `${SHARED_CONFIG.SCROLL.CSS_PROPERTY_PREFIX}progress`,
            progress.toFixed(4),
          );
          lastProgress = progress;
        }

        // Call all handlers
        this.handlers.forEach(({ handler, name }) => {
          try {
            handler(progress);
          } catch (error) {
            log.error(`Error in parallax handler '${name}':`, error);
          }
        });
      }, SHARED_CONFIG.PERFORMANCE.THROTTLE_MS)
    );

    window.addEventListener('scroll', this.scrollHandler, { passive: true });
    this.isActive = true;

    // Initial call - trigger manually with a synthetic scroll
    this.scrollHandler(/** @type {Event} */ (new Event('scroll')));

    log.info('Parallax manager activated');
  }

  deactivate() {
    if (!this.isActive) return;

    if (this.scrollHandler) {
      window.removeEventListener('scroll', this.scrollHandler);
      this.scrollHandler = null;
    }

    this.isActive = false;
    this.handlers.clear();

    log.info('Parallax manager deactivated');
  }
}

// ===== Cleanup Manager =====

class SharedCleanupManager {
  constructor() {
    this.cleanupFunctions = new Map();
  }

  /**
   * @param {string} systemName
   * @param {Function} cleanupFn
   * @param {string} description
   */
  addCleanupFunction(systemName, cleanupFn, description = 'anonymous') {
    if (typeof cleanupFn !== 'function') {
      log.error(
        `Invalid cleanup function for '${systemName}', must be a function`,
      );
      return;
    }

    if (!this.cleanupFunctions.has(systemName)) {
      this.cleanupFunctions.set(systemName, []);
    }

    this.cleanupFunctions.get(systemName).push({ fn: cleanupFn, description });
  }

  /**
   * @param {string} systemName
   */
  cleanupSystem(systemName) {
    const systemCleanups = this.cleanupFunctions.get(systemName);
    if (!systemCleanups || systemCleanups.length === 0) {
      log.debug(`No cleanup functions for system '${systemName}'`);
      return;
    }

    log.info(
      `Cleaning up system '${systemName}' (${systemCleanups.length} functions)`,
    );

    let successCount = 0;
    let errorCount = 0;

    systemCleanups.forEach(
      /** @param {{fn: Function, description: string}} param0 */
      ({ fn, description }) => {
        try {
          fn();
          successCount++;
        } catch (error) {
          errorCount++;
          log.error(
            `Error in cleanup '${description}' for '${systemName}':`,
            error,
          );
        }
      },
    );

    this.cleanupFunctions.delete(systemName);

    log.info(
      `System '${systemName}' cleanup complete: ${successCount} success, ${errorCount} errors`,
    );
  }

  cleanupAll() {
    log.info('Starting global cleanup of all systems');

    const systemNames = Array.from(this.cleanupFunctions.keys());
    systemNames.forEach((systemName) => this.cleanupSystem(systemName));

    // Deactivate parallax
    sharedParallaxManager.deactivate();

    sharedState.reset();

    log.info('Global cleanup completed');
  }

  /**
   * @param {string} systemName
   */
  hasSystem(systemName) {
    return this.cleanupFunctions.has(systemName);
  }

  getSystemCount() {
    return this.cleanupFunctions.size;
  }
}

// ===== Singleton Instances =====

export const sharedParallaxManager = new SharedParallaxManager();
export const sharedCleanupManager = new SharedCleanupManager();

// ===== Particle System Registration =====

/**
 * @param {string} name
 * @param {any} instance
 */
export function registerParticleSystem(name, instance) {
  sharedState.registerSystem(name, instance);
}

/**
 * @param {string} name
 */
export function unregisterParticleSystem(name) {
  return sharedState.unregisterSystem(name);
}

// ===== Global Cleanup Hook =====

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', (event) => {
    // Only cleanup if the page is actually unloading, not just entering bfcache
    if (!event.persisted) {
      sharedCleanupManager.cleanupAll();
    }
  });
}
