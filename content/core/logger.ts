/**
 * Modern Logger with Performance Tracking
 * @version 3.0.0
 */

type LogLevelName = 'error' | 'warn' | 'info' | 'debug' | 'trace';

const LOG_LEVELS: Record<LogLevelName, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
  trace: 4,
};

type LoggerOptions = {
  level?: number;
  performance?: boolean;
  timestamps?: boolean;
};

/** Cached default log level — computed once, reused by all Logger instances */
let _cachedDefaultLevel: number | null = null;
function getDefaultLogLevel(): number {
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
  private category: string;
  private prefix: string;
  private level: number;
  private performance: boolean;
  private timestamps: boolean;

  constructor(category: string, options: LoggerOptions = {}) {
    this.category = category;
    this.prefix = `[${category}]`;
    this.level =
      options.level !== undefined ? options.level : getDefaultLogLevel();
    this.performance = options.performance ?? true;
    this.timestamps = options.timestamps ?? false;
  }

  private shouldLog(level: LogLevelName): boolean {
    return LOG_LEVELS[level] <= this.level;
  }

  private formatMessage(message: string, ...args: unknown[]) {
    const parts: string[] = [this.prefix];
    if (this.timestamps) {
      parts.push(`[${new Date().toISOString()}]`);
    }
    parts.push(message);
    return { parts, args };
  }

  error(message: string, ...args: unknown[]): void {
    if (!this.shouldLog('error')) return;
    const { parts, args: formattedArgs } = this.formatMessage(message, ...args);
    console.error(...parts, ...formattedArgs);
  }

  warn(message: string, ...args: unknown[]): void {
    if (!this.shouldLog('warn')) return;
    const { parts, args: formattedArgs } = this.formatMessage(message, ...args);
    console.warn(...parts, ...formattedArgs);
  }

  info(message: string, ...args: unknown[]): void {
    if (!this.shouldLog('info')) return;
    const { parts, args: formattedArgs } = this.formatMessage(message, ...args);
    console.info(...parts, ...formattedArgs);
  }

  debug(message: string, ...args: unknown[]): void {
    if (!this.shouldLog('debug')) return;
    const { parts, args: formattedArgs } = this.formatMessage(message, ...args);
    console.debug(...parts, ...formattedArgs);
  }

  trace(message: string, ...args: unknown[]): void {
    if (!this.shouldLog('trace')) return;
    const { parts, args: formattedArgs } = this.formatMessage(message, ...args);
    console.trace(...parts, ...formattedArgs);
  }

  time(label: string): void {
    if (!this.performance || !this.shouldLog('debug')) return;
    console.time(`${this.prefix} ${label}`);
  }

  timeEnd(label: string): void {
    if (!this.performance || !this.shouldLog('debug')) return;
    console.timeEnd(`${this.prefix} ${label}`);
  }

  group(label: string): void {
    if (!this.shouldLog('debug')) return;
    console.group(`${this.prefix} ${label}`);
  }

  groupEnd(): void {
    if (!this.shouldLog('debug')) return;
    console.groupEnd();
  }

  table(data: unknown): void {
    if (!this.shouldLog('debug')) return;
    console.table(data);
  }
}

export function createLogger(
  category: string,
  options?: LoggerOptions,
): Logger {
  return new Logger(category, options);
}
