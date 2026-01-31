/**
 * Timer Utilities
 * Centralized timer management with automatic cleanup
 * @author Abdulkerim Sesli
 * @version 1.0.0
 */

import { createLogger } from './logger.js';

const log = createLogger('TimerUtils');

/**
 * Timer Manager Class
 * Manages setTimeout and setInterval with automatic cleanup
 */
export class TimerManager {
  constructor(name = 'TimerManager') {
    this.name = name;
    this.timers = new Set();
    this.intervals = new Set();
    this.rafIds = new Set();
  }

  setTimeout(fn, delay) {
    const id = setTimeout(() => {
      this.timers.delete(id);
      try {
        fn();
      } catch (err) {
        log.error(`[${this.name}] setTimeout error:`, err);
      }
    }, delay);
    this.timers.add(id);
    return id;
  }

  setInterval(fn, delay) {
    const id = setInterval(() => {
      try {
        fn();
      } catch (err) {
        log.error(`[${this.name}] setInterval error:`, err);
      }
    }, delay);
    this.intervals.add(id);
    return id;
  }

  requestAnimationFrame(fn) {
    const id = requestAnimationFrame(() => {
      this.rafIds.delete(id);
      try {
        fn();
      } catch (err) {
        log.error(`[${this.name}] RAF error:`, err);
      }
    });
    this.rafIds.add(id);
    return id;
  }

  clearTimeout(id) {
    clearTimeout(id);
    this.timers.delete(id);
  }

  clearInterval(id) {
    clearInterval(id);
    this.intervals.delete(id);
  }

  cancelAnimationFrame(id) {
    cancelAnimationFrame(id);
    this.rafIds.delete(id);
  }

  clearAll() {
    this.timers.forEach((id) => clearTimeout(id));
    this.intervals.forEach((id) => clearInterval(id));
    this.rafIds.forEach((id) => cancelAnimationFrame(id));
    this.timers.clear();
    this.intervals.clear();
    this.rafIds.clear();
  }

  // sleep() method removed - use imported sleep from async-utils.js instead
  // import { sleep } from '/content/core/utils.js';

  get activeTimers() {
    return {
      timeouts: this.timers.size,
      intervals: this.intervals.size,
      rafs: this.rafIds.size,
      total: this.timers.size + this.intervals.size + this.rafIds.size,
    };
  }
}

/**
 * Optimized scroll handler with requestAnimationFrame
 */
export function createScrollHandler(callback, options = {}) {
  const { passive = true } = options;
  let ticking = false;
  let lastScrollY = window.scrollY;

  const handler = () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        const currentScrollY = window.scrollY;
        callback(currentScrollY, lastScrollY);
        lastScrollY = currentScrollY;
        ticking = false;
      });
      ticking = true;
    }
  };

  return {
    handler,
    attach: () => window.addEventListener('scroll', handler, { passive }),
    detach: () => window.removeEventListener('scroll', handler),
  };
}

/**
 * Optimized resize handler with debouncing
 */
export function createResizeHandler(callback, delay = 150) {
  let timeoutId = null;
  let ticking = false;

  const handler = () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          callback(window.innerWidth, window.innerHeight);
          ticking = false;
        }, delay);
      });
      ticking = true;
    }
  };

  return {
    handler,
    attach: () => window.addEventListener('resize', handler, { passive: true }),
    detach: () => {
      window.removeEventListener('resize', handler);
      clearTimeout(timeoutId);
    },
  };
}
