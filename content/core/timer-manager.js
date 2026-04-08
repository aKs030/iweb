/**
 * Timer Manager - Centralized timer lifecycle management
 * @version 1.0.0
 */

import { createLogger } from './logger.js';

const log = createLogger('TimerManager');

/**
 * Timer Manager for automatic cleanup of timeouts, intervals, and RAF
 */
export class TimerManager {
  constructor(name = 'TimerManager') {
    this.name = name;
    this.timers = new Set();
    this.intervals = new Set();
    this.rafIds = new Set();
  }

  _runSafely(label, fn) {
    try {
      fn();
    } catch (err) {
      log.error(`[${this.name}] ${label} error:`, err);
    }
  }

  setTimeout(fn, delay) {
    const id = setTimeout(() => {
      this.timers.delete(id);
      this._runSafely('setTimeout', fn);
    }, delay);
    this.timers.add(id);
    return id;
  }

  setInterval(fn, delay) {
    const id = setInterval(() => {
      this._runSafely('setInterval', fn);
    }, delay);
    this.intervals.add(id);
    return id;
  }

  requestAnimationFrame(fn) {
    const id = requestAnimationFrame(() => {
      this.rafIds.delete(id);
      this._runSafely('RAF', fn);
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
