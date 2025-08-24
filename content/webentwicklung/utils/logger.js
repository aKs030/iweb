// Erweiterte Logger-Utility mit Namensraum, Level-Filter, Buffer und Safe-Call
// Level-Hierarchie: error(0) < warn(1) < info(2) < debug(3)
const LEVELS = { error:0, warn:1, info:2, debug:3 };

// Ring-Buffer für letzte Logs (konfigurierbar)
const DEFAULT_BUFFER_SIZE = 200;
const logBuffer = [];
let bufferSize = DEFAULT_BUFFER_SIZE;
let autoFlushHandler = null; // optionaler Callback

function pushToBuffer(entry) {
  logBuffer.push(entry);
  if (logBuffer.length > bufferSize) logBuffer.shift();
  // Event dispatch für UI / Tools
  try {
    window.dispatchEvent(new CustomEvent('logEvent', { detail: entry }));
  } catch {}
  if (entry.level === 'error' && autoFlushHandler) {
    try { autoFlushHandler(getBufferedLogs()); } catch {}
  }
}

export function getBufferedLogs() { return [...logBuffer]; }
export function setLogBufferSize(size) { bufferSize = Math.max(10, Number(size)||DEFAULT_BUFFER_SIZE); }
export function onAutoFlush(handler) { autoFlushHandler = typeof handler === 'function' ? handler : null; }
export function clearLogBuffer() { logBuffer.length = 0; }
export function flushLogs({ transport, clear = false } = {}) {
  const data = getBufferedLogs();
  if (typeof transport === 'function') {
    try { transport(data); } catch (e) { console.warn('[logger] flush transport failed', e); }
  }
  if (clear) clearLogBuffer();
  return data;
}

// Ermittelt global konfigurierten Level (window.LOG_LEVEL oder Fallback); akzeptiert Name oder Zahl
function resolveGlobalLevel() {
  const gl = (typeof window !== 'undefined') ? (window.LOG_LEVEL ?? window.LOGLEVEL ?? window.logLevel) : undefined;
  if (gl == null) {
    // DEBUG true erzwingt debug-Level
    if (typeof window !== 'undefined' && typeof window.DEBUG !== 'undefined') {
      return window.DEBUG ? LEVELS.debug : LEVELS.info;
    }
    return LEVELS.info; // Standard
  }
  if (typeof gl === 'string') {
    const lower = gl.toLowerCase();
    if (lower in LEVELS) return LEVELS[lower];
    const asNum = Number(gl);
    if (!Number.isNaN(asNum)) return Math.max(0, Math.min(LEVELS.debug, asNum));
    return LEVELS.info;
  }
  if (typeof gl === 'number') {
    return Math.max(0, Math.min(LEVELS.debug, gl));
  }
  return LEVELS.info;
}

let GLOBAL_LEVEL = resolveGlobalLevel();

export function setGlobalLogLevel(lvl) {
  if (typeof lvl === 'string' && lvl.toLowerCase() in LEVELS) GLOBAL_LEVEL = LEVELS[lvl.toLowerCase()];
  else if (typeof lvl === 'number') GLOBAL_LEVEL = Math.max(0, Math.min(LEVELS.debug, lvl));
  if (typeof window !== 'undefined') window.LOG_LEVEL = GLOBAL_LEVEL;
  return GLOBAL_LEVEL;
}

export function getGlobalLogLevel() { return GLOBAL_LEVEL; }

export function createLogger(namespace = 'app') {
  const prefix = `[${namespace}]`;
  function enabled(levelName) { return LEVELS[levelName] <= GLOBAL_LEVEL; }
  function base(level, consoleFn, args) {
    const ts = Date.now();
    const entry = { ts, level, namespace, args };
    pushToBuffer(entry);
    if (enabled(level)) consoleFn(prefix, ...args);
  }
  return {
    error: (...args) => base('error', console.error, args),
    warn:  (...args) => base('warn', console.warn, args),
    info:  (...args) => base('info', console.info, args),
    debug: (...args) => base('debug', console.debug, args),
    setLevel: (l) => setGlobalLogLevel(l),
    getLevel: () => GLOBAL_LEVEL,
    levels: { ...LEVELS },
    buffer: { get: getBufferedLogs, clear: clearLogBuffer, flush: flushLogs },
  };
}

export function safeCall(fn, { logger, label = 'safeCall' } = {}) {
  try {
    return fn();
  } catch (err) {
    logger?.error?.(`${label} failed:`, err);
    return undefined;
  }
}

// Globaler Fallback
if (!window.__logger) {
  window.__logger = createLogger('global');
}

// Reagiere dynamisch auf nachträgliche Änderung von window.LOG_LEVEL (Polling vermeiden: defineProperty Hook)
if (typeof window !== 'undefined' && !window.__logLevelPatched) {
  let _lv = GLOBAL_LEVEL;
  try {
    Object.defineProperty(window, 'LOG_LEVEL', {
      configurable: true,
      get() { return _lv; },
      set(v) { setGlobalLogLevel(v); _lv = GLOBAL_LEVEL; }
    });
  } catch (_err) {
    // Fallback: direkte Zuweisung ohne Getter/Setter + einfache Warnung
    window.LOG_LEVEL = _lv;
    console.warn('[logger] Konnte window.LOG_LEVEL Property nicht definieren:', _err);
  }
  window.__logLevelPatched = true;
}

// Automatischer Flush bei unhandledrejection / error (optional nutzbar)
window.addEventListener('unhandledrejection', (e) => {
  if (e?.reason) pushToBuffer({ ts: Date.now(), level:'error', namespace:'unhandledrejection', args:[e.reason] });
});
window.addEventListener('error', (e) => {
  if (e?.error) pushToBuffer({ ts: Date.now(), level:'error', namespace:'error', args:[e.error] });
});
