/**
 * Timer Manager - Centralized timer lifecycle management
 * @version 1.0.0
 */

import { createLogger } from "../logger.js";

const log = createLogger("TimerManager");

/**
 * Timer Manager for automatic cleanup of timeouts, intervals, and RAF
 * Tracks all timer operations and provides centralized cleanup
 */
export class TimerManager {
  /**
   * Create a new timer manager instance
   * @param {string} [name="TimerManager"] - Manager instance name for logging
   */
  constructor(name = "TimerManager") {
    this.name = name;
    this.timers = new Set();
    this.intervals = new Set();
    this.rafIds = new Set();
  }

  /**
   * Execute a callback with error handling
   * @private
   * @param {string} label - Operation label for logging
   * @param {Function} fn - Callback to execute
   */
  _runSafely(label, fn) {
    try {
      fn();
    } catch (err) {
      log.error(`[${this.name}] ${label} error:`, err);
    }
  }

  /**
   * Schedule a timeout with automatic tracking
   * @param {Function} fn - Callback to execute
   * @param {number} delay - Delay in milliseconds
   * @returns {number} Timeout ID
   */
  setTimeout(fn, delay) {
    const id = setTimeout(() => {
      this.timers.delete(id);
      this._runSafely("setTimeout", fn);
    }, delay);
    this.timers.add(id);
    return id;
  }

  /**
   * Schedule an interval with automatic tracking
   * @param {Function} fn - Callback to execute repeatedly
   * @param {number} delay - Interval in milliseconds
   * @returns {number} Interval ID
   */
  setInterval(fn, delay) {
    const id = setInterval(() => {
      this._runSafely("setInterval", fn);
    }, delay);
    this.intervals.add(id);
    return id;
  }

  /**
   * Schedule a request animation frame with automatic tracking
   * @param {FrameRequestCallback} fn - Callback to execute
   * @returns {number} RAF ID
   */
  requestAnimationFrame(fn) {
    const id = requestAnimationFrame(() => {
      this.rafIds.delete(id);
      this._runSafely("RAF", fn);
    });
    this.rafIds.add(id);
    return id;
  }

  /**
   * Clear a scheduled timeout
   * @param {number} id - Timeout ID
   */
  clearTimeout(id) {
    clearTimeout(id);
    this.timers.delete(id);
  }

  /**
   * Clear a scheduled interval
   * @param {number} id - Interval ID
   */
  clearInterval(id) {
    clearInterval(id);
    this.intervals.delete(id);
  }

  /**
   * Cancel a scheduled animation frame
   * @param {number} id - RAF ID
   */
  cancelAnimationFrame(id) {
    cancelAnimationFrame(id);
    this.rafIds.delete(id);
  }

  /**
   * Clear all scheduled timers, intervals, and animation frames
   */
  clearAll() {
    this.timers.forEach(id => clearTimeout(id));
    this.intervals.forEach(id => clearInterval(id));
    this.rafIds.forEach(id => cancelAnimationFrame(id));
    this.timers.clear();
    this.intervals.clear();
    this.rafIds.clear();
  }

  /**
   * Get count of active timers
   * @returns {{timeouts: number, intervals: number, rafs: number, total: number}}
   */
  get activeTimers() {
    return {
      timeouts: this.timers.size,
      intervals: this.intervals.size,
      rafs: this.rafIds.size,
      total: this.timers.size + this.intervals.size + this.rafIds.size,
    };
  }
}
