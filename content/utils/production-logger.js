/**
 * Production Logger
 * @version 1.0.0
 * @description Safe logging that respects production environment
 */

// Environment detection
const isProduction = (() => {
  try {
    return (
      window.location.hostname !== 'localhost' &&
      !window.location.hostname.includes('127.0.0.1') &&
      !window.location.search.includes('debug')
    );
  } catch {
    return true;
  }
})();

const isDevelopment = !isProduction;

/**
 * Safe console wrapper that respects environment
 */
class ProductionLogger {
  constructor(prefix = '') {
    this.prefix = prefix;
    this.enabled = isDevelopment;
    this.forceEnabled = false;
  }

  /**
   * Force enable logging (for debugging in production)
   */
  enable() {
    this.forceEnabled = true;
  }

  /**
   * Disable logging
   */
  disable() {
    this.forceEnabled = false;
  }

  /**
   * Check if logging is allowed
   */
  shouldLog(level = 'log') {
    if (this.forceEnabled) return true;
    if (isDevelopment) return true;

    // In production, only allow errors
    return level === 'error';
  }

  /**
   * Format message with prefix
   */
  format(message, ...args) {
    const timestamp = new Date().toISOString();
    const prefix = this.prefix ? `[${this.prefix}]` : '';
    return [`${timestamp} ${prefix}`, message, ...args];
  }

  /**
   * Log message (development only)
   */
  log(message, ...args) {
    if (this.shouldLog('log')) {
      console.log(...this.format(message, ...args));
    }
  }

  /**
   * Log info (development only)
   */
  info(message, ...args) {
    if (this.shouldLog('info')) {
      console.info(...this.format(message, ...args));
    }
  }

  /**
   * Log warning (development only)
   */
  warn(message, ...args) {
    if (this.shouldLog('warn')) {
      console.warn(...this.format(message, ...args));
    }
  }

  /**
   * Log error (always logged)
   */
  error(message, ...args) {
    if (this.shouldLog('error')) {
      console.error(...this.format(message, ...args));
    }
  }

  /**
   * Log debug (development only)
   */
  debug(message, ...args) {
    if (this.shouldLog('debug')) {
      console.debug(...this.format(message, ...args));
    }
  }

  /**
   * Log table (development only)
   */
  table(data) {
    if (this.shouldLog('table') && console.table) {
      console.table(data);
    }
  }

  /**
   * Log group (development only)
   */
  group(label) {
    if (this.shouldLog('group') && console.group) {
      console.group(label);
    }
  }

  /**
   * Log group collapsed (development only)
   */
  groupCollapsed(label) {
    if (this.shouldLog('group') && console.groupCollapsed) {
      console.groupCollapsed(label);
    }
  }

  /**
   * End log group (development only)
   */
  groupEnd() {
    if (this.shouldLog('group') && console.groupEnd) {
      console.groupEnd();
    }
  }

  /**
   * Time measurement (development only)
   */
  time(label) {
    if (this.shouldLog('time') && console.time) {
      console.time(label);
    }
  }

  /**
   * End time measurement (development only)
   */
  timeEnd(label) {
    if (this.shouldLog('time') && console.timeEnd) {
      console.timeEnd(label);
    }
  }

  /**
   * Assert (development only)
   */
  assert(condition, message, ...args) {
    if (this.shouldLog('assert') && console.assert) {
      console.assert(condition, ...this.format(message, ...args));
    }
  }
}

/**
 * Create logger instance
 */
export function createProductionLogger(prefix = '') {
  return new ProductionLogger(prefix);
}

/**
 * Default logger instance
 */
export const logger = new ProductionLogger();

/**
 * Environment helpers
 */
export const env = {
  isProduction,
  isDevelopment,
  isDebug: () => {
    try {
      return (
        window.location.search.includes('debug') ||
        localStorage.getItem('debug') === 'true'
      );
    } catch {
      return false;
    }
  },
};

/**
 * Safe wrapper for console methods
 * Replaces direct console usage
 */
export const safeConsole = {
  log: (...args) => logger.log(...args),
  info: (...args) => logger.info(...args),
  warn: (...args) => logger.warn(...args),
  error: (...args) => logger.error(...args),
  debug: (...args) => logger.debug(...args),
  table: (data) => logger.table(data),
  group: (label) => logger.group(label),
  groupCollapsed: (label) => logger.groupCollapsed(label),
  groupEnd: () => logger.groupEnd(),
  time: (label) => logger.time(label),
  timeEnd: (label) => logger.timeEnd(label),
  assert: (condition, ...args) => logger.assert(condition, ...args),
};

export default logger;
