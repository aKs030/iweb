/**
 * Modern Logger with Performance Tracking
 * @version 3.0.0
 */
const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
  trace: 4,
};
/** Cached default log level — computed once, reused by all Logger instances */
let _cachedDefaultLevel = null;
function getDefaultLogLevel() {
  if (_cachedDefaultLevel !== null) return _cachedDefaultLevel;
  if (typeof window === 'undefined') {
    _cachedDefaultLevel = LOG_LEVELS.warn;
    return _cachedDefaultLevel;
  }
  try {
    const hostname = window.location?.hostname || '';
    const isProd =
      hostname &&
      hostname !== 'localhost' &&
      hostname !== '127.0.0.1' &&
      !hostname.startsWith('192.168.');
    const params = new URLSearchParams(window.location.search);
    if (params.get('debug') === 'true') {
      _cachedDefaultLevel = LOG_LEVELS.debug;
      return _cachedDefaultLevel;
    }
    try {
      const stored = window.localStorage?.getItem('iweb-debug');
      if (stored === 'true') {
        _cachedDefaultLevel = LOG_LEVELS.debug;
        return _cachedDefaultLevel;
      }
    } catch {
      // localStorage may throw SecurityError in private browsing
    }
    _cachedDefaultLevel = isProd ? LOG_LEVELS.error : LOG_LEVELS.warn;
  } catch {
    _cachedDefaultLevel = LOG_LEVELS.warn;
  }
  return _cachedDefaultLevel;
}
class Logger {
  category;
  prefix;
  level;
  performance;
  timestamps;
  constructor(category, options = {}) {
    this.category = category;
    this.prefix = `[${category}]`;
    this.level =
      options.level !== undefined ? options.level : getDefaultLogLevel();
    this.performance = options.performance ?? true;
    this.timestamps = options.timestamps ?? false;
  }
  shouldLog(level) {
    return LOG_LEVELS[level] <= this.level;
  }
  formatMessage(message, ...args) {
    const parts = [this.prefix];
    if (this.timestamps) {
      parts.push(`[${new Date().toISOString()}]`);
    }
    parts.push(message);
    return { parts, args };
  }
  error(message, ...args) {
    if (!this.shouldLog('error')) return;
    const { parts, args: formattedArgs } = this.formatMessage(message, ...args);
    console.error(...parts, ...formattedArgs);
  }
  warn(message, ...args) {
    if (!this.shouldLog('warn')) return;
    const { parts, args: formattedArgs } = this.formatMessage(message, ...args);
    console.warn(...parts, ...formattedArgs);
  }
  info(message, ...args) {
    if (!this.shouldLog('info')) return;
    const { parts, args: formattedArgs } = this.formatMessage(message, ...args);
    console.info(...parts, ...formattedArgs);
  }
  debug(message, ...args) {
    if (!this.shouldLog('debug')) return;
    const { parts, args: formattedArgs } = this.formatMessage(message, ...args);
    console.debug(...parts, ...formattedArgs);
  }
  trace(message, ...args) {
    if (!this.shouldLog('trace')) return;
    const { parts, args: formattedArgs } = this.formatMessage(message, ...args);
    console.trace(...parts, ...formattedArgs);
  }
  time(label) {
    if (!this.performance || !this.shouldLog('debug')) return;
    console.time(`${this.prefix} ${label}`);
  }
  timeEnd(label) {
    if (!this.performance || !this.shouldLog('debug')) return;
    console.timeEnd(`${this.prefix} ${label}`);
  }
  group(label) {
    if (!this.shouldLog('debug')) return;
    console.group(`${this.prefix} ${label}`);
  }
  groupEnd() {
    if (!this.shouldLog('debug')) return;
    console.groupEnd();
  }
  table(data) {
    if (!this.shouldLog('debug')) return;
    console.table(data);
  }
}
/** @type {Map<string, Logger>} */
const _registry = new Map();

/**
 * Create or retrieve a cached Logger instance for a category.
 * @param {string} category
 * @param {Object} [options]
 * @returns {Logger}
 */
export function createLogger(category, options) {
  if (!options && _registry.has(category)) return _registry.get(category);
  const logger = new Logger(category, options);
  if (!options) _registry.set(category, logger);
  return logger;
}

/**
 * Change the log level for all existing loggers at runtime.
 * @param {keyof typeof LOG_LEVELS} level
 */
export function setGlobalLogLevel(level) {
  const numeric = LOG_LEVELS[level];
  if (numeric === undefined) return;
  _cachedDefaultLevel = numeric;
  for (const logger of _registry.values()) {
    logger.level = numeric;
  }
}
