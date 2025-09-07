// Erweiterte Logger-Utility - Performance Optimized
// Level-Hierarchie: error(0) < warn(1) < info(2) < debug(3)
const LEVELS = { error:0, warn:1, info:2, debug:3 };

// Ring-Buffer für letzte Logs - reduziert für bessere Performance
const logBuffer = [];
const BUFFER_SIZE = 50; // Reduziert von 200 auf 50

function pushToBuffer(entry) {
  logBuffer.push(entry);
  if (logBuffer.length > BUFFER_SIZE) logBuffer.shift();
  // Event dispatch nur bei Bedarf
  if (window.__logEventListeners > 0) {
    try {
      window.dispatchEvent(new CustomEvent('logEvent', { detail: entry }));
    } catch {
      // Ignore event dispatch errors
    }
  }
}

// Optimierte Level-Auflösung
function resolveGlobalLevel() {
  if (typeof window === 'undefined') return LEVELS.warn;
  
  const gl = window.LOG_LEVEL ?? window.LOGLEVEL ?? window.logLevel;
  if (gl === null || gl === undefined) {
    return window.DEBUG ? LEVELS.debug : LEVELS.warn; // Standard auf warn
  }
  
  if (typeof gl === 'string') {
    const lower = gl.toLowerCase();
    return LEVELS[lower] ?? LEVELS.warn;
  }
  
  if (typeof gl === 'number') {
    return Math.max(0, Math.min(LEVELS.debug, gl));
  }
  
  return LEVELS.warn;
}

let GLOBAL_LEVEL = resolveGlobalLevel();

export function setGlobalLogLevel(lvl) {
  if (typeof lvl === 'string' && lvl.toLowerCase() in LEVELS) GLOBAL_LEVEL = LEVELS[lvl.toLowerCase()];
  else if (typeof lvl === 'number') GLOBAL_LEVEL = Math.max(0, Math.min(LEVELS.debug, lvl));
  // Entferne die direkte window.LOG_LEVEL Zuweisung um Rekursion zu vermeiden
  return GLOBAL_LEVEL;
}

export function getGlobalLogLevel() { return GLOBAL_LEVEL; }

export function createLogger(namespace = 'app') {
  const prefix = `[${namespace}]`;
  
  function enabled(levelName) { 
    return LEVELS[levelName] <= GLOBAL_LEVEL; 
  }
  
  function base(level, consoleFn, args) {
    if (!enabled(level)) return; // Frühe Rückkehr für bessere Performance
    
    const ts = Date.now();
    const entry = { ts, level, namespace, args };
    pushToBuffer(entry);
    consoleFn(prefix, ...args);
  }
  
  return {
    error: (...args) => base('error', console.error, args),
    warn:  (...args) => base('warn', console.warn, args),
    info:  (...args) => base('info', (...logArgs) => console.warn('[INFO]', ...logArgs), args),
    debug: (...args) => base('debug', (...logArgs) => console.warn('[DEBUG]', ...logArgs), args),
    setLevel: (l) => setGlobalLogLevel(l),
    getLevel: () => GLOBAL_LEVEL,
    levels: { ...LEVELS },
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

// Globaler Fallback - nur einmal erstellen
if (!window.__logger) {
  window.__logger = createLogger('global');
}

// Event-Listener-Counter für Performance
window.__logEventListeners = 0;

// Optimierte LOG_LEVEL Property Definition
if (typeof window !== 'undefined' && !window.__logLevelPatched) {
  window.__logLevelPatched = true;
  let _lv = GLOBAL_LEVEL;
  try {
    Object.defineProperty(window, 'LOG_LEVEL', {
      configurable: true,
      get() { return _lv; },
      set(v) { 
        if (typeof v === 'string' && v.toLowerCase() in LEVELS) {
          _lv = LEVELS[v.toLowerCase()];
        } else if (typeof v === 'number') {
          _lv = Math.max(0, Math.min(LEVELS.debug, v));
        }
        GLOBAL_LEVEL = _lv;
      }
    });
  } catch (error) {
    console.warn('Failed to setup LOG_LEVEL property:', error);
  }
}
