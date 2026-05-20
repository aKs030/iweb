/* eslint-disable no-console */
import { isLocalDevHost } from "./runtime-env.js";

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
  const runtimeLocation = globalThis.location;
  if (!runtimeLocation) {
    _cachedDefaultLevel = LOG_LEVELS.warn;
    return _cachedDefaultLevel;
  }
  try {
    const hostname = runtimeLocation.hostname || "";
    const isProd = Boolean(hostname) && !isLocalDevHost(hostname);
    const params = new URLSearchParams(runtimeLocation.search || "");
    if (params.get("debug") === "true") {
      _cachedDefaultLevel = LOG_LEVELS.debug;
      return _cachedDefaultLevel;
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
    this.level = options.level !== undefined ? options.level : getDefaultLogLevel();
    this.performance = options.performance ?? true;
    this.timestamps = options.timestamps ?? false;
  }
  shouldLog(level) {
    return LOG_LEVELS[level] <= this.level;
  }
  _log(method, message, args) {
    if (this.timestamps) method(this.prefix, `[${new Date().toISOString()}]`, message, ...args);
    else method(this.prefix, message, ...args);
  }
  error(message, ...args) {
    if (this.shouldLog("error")) this._log(console.error, message, args);
  }
  warn(message, ...args) {
    if (this.shouldLog("warn")) this._log(console.warn, message, args);
  }
  info(message, ...args) {
    if (this.shouldLog("info")) this._log(console.info, message, args);
  }
  debug(message, ...args) {
    if (this.shouldLog("debug")) this._log(console.debug, message, args);
  }
  trace(message, ...args) {
    if (this.shouldLog("trace")) this._log(console.trace, message, args);
  }
  time(label) {
    if (!this.performance || !this.shouldLog("debug")) return;
    console.time(`${this.prefix} ${label}`);
  }
  timeEnd(label) {
    if (!this.performance || !this.shouldLog("debug")) return;
    console.timeEnd(`${this.prefix} ${label}`);
  }
  group(label) {
    if (!this.shouldLog("debug")) return;
    console.group(`${this.prefix} ${label}`);
  }
  groupEnd() {
    if (!this.shouldLog("debug")) return;
    console.groupEnd();
  }
  table(data) {
    if (!this.shouldLog("debug")) return;
    console.table(data);
  }
}
export function createLogger(category, options) {
  return new Logger(category, options);
}
