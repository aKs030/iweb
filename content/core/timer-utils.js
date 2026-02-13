/**
 * Timer Utilities
 * Centralized timer management with automatic cleanup
 * @author Abdulkerim Sesli
 * @version 1.1.0
 */

import { createLogger } from './logger.js';
import { sleep } from './utils.js'; // Import sleep from utils

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

  get activeTimers() {
    return {
      timeouts: this.timers.size,
      intervals: this.intervals.size,
      rafs: this.rafIds.size,
      total: this.timers.size + this.intervals.size + this.rafIds.size,
    };
  }
}

// Re-export sleep for convenience
export { sleep };
