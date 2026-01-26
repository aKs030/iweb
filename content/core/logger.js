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

class Logger {
  constructor(category, options = {}) {
    this.category = category;
    this.prefix = `[${category}]`;
    this.level = options.level !== undefined ? options.level : this.detectLogLevel();
    this.performance = options.performance ?? true;
    this.timestamps = options.timestamps ?? false;
  }

  detectLogLevel() {
    if (typeof window === 'undefined') return LOG_LEVELS.warn;

    const hostname = window.location?.hostname || '';
    const isProd =
      hostname &&
      hostname !== 'localhost' &&
      hostname !== '127.0.0.1' &&
      !hostname.startsWith('192.168.');

    const params = new URLSearchParams(window.location.search);
    if (params.get('debug') === 'true') return LOG_LEVELS.debug;

    const stored = localStorage?.getItem('iweb-debug');
    if (stored === 'true') return LOG_LEVELS.debug;

    return isProd ? LOG_LEVELS.error : LOG_LEVELS.warn;
  }

  shouldLog(level) {
    return LOG_LEVELS[level] <= this.level;
  }

  formatMessage(level, message, ...args) {
    const parts = [this.prefix];
    if (this.timestamps) {
      parts.push(`[${new Date().toISOString()}]`);
    }
    parts.push(message);
    return { parts, args };
  }

  error(message, ...args) {
    if (!this.shouldLog('error')) return;
    const { parts, args: formattedArgs } = this.formatMessage(
      'error',
      message,
      ...args,
    );
    console.error(...parts, ...formattedArgs);
  }

  warn(message, ...args) {
    if (!this.shouldLog('warn')) return;
    const { parts, args: formattedArgs } = this.formatMessage(
      'warn',
      message,
      ...args,
    );
    console.warn(...parts, ...formattedArgs);
  }

  info(message, ...args) {
    if (!this.shouldLog('info')) return;
    const { parts, args: formattedArgs } = this.formatMessage(
      'info',
      message,
      ...args,
    );
    console.info(...parts, ...formattedArgs);
  }

  debug(message, ...args) {
    if (!this.shouldLog('debug')) return;
    const { parts, args: formattedArgs } = this.formatMessage(
      'debug',
      message,
      ...args,
    );
    console.debug(...parts, ...formattedArgs);
  }

  trace(message, ...args) {
    if (!this.shouldLog('trace')) return;
    const { parts, args: formattedArgs } = this.formatMessage(
      'trace',
      message,
      ...args,
    );
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

export function createLogger(category, options) {
  return new Logger(category, options);
}

export { Logger, LOG_LEVELS };
