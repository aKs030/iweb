/* eslint-disable no-console */ // Lightweight client-side logger wrapper
// - Exposes `createClientLogger(category)` and also sets `window.iwebLogger` for non-module code
// - Honours `window.IWEB_LOGGING_ENABLED` when explicitly set to `false` to disable logs

const ENABLED = typeof window !== 'undefined' ? window.IWEB_LOGGING_ENABLED !== false : true;

function _formatPrefix(category) {
  const time = new Date().toISOString();
  return `[iweb:${category}] ${time} -`;
}

export function createClientLogger(category = 'client') {
  return {
    info: (...args) => {
      if (!ENABLED) return;
      if (typeof console !== 'undefined' && console.info)
        console.info(_formatPrefix(category), ...args);
    },
    warn: (...args) => {
      if (!ENABLED) return;
      if (typeof console !== 'undefined' && console.warn)
        console.warn(_formatPrefix(category), ...args);
    },
    error: (...args) => {
      if (!ENABLED) return;
      if (typeof console !== 'undefined' && console.error)
        console.error(_formatPrefix(category), ...args);
    },
    debug: (...args) => {
      if (!ENABLED) return;
      if (typeof console !== 'undefined' && console.debug)
        console.debug(_formatPrefix(category), ...args);
    },
  };
}

// Expose global fallback for non-module code
if (typeof window !== 'undefined') {
  window.iwebLogger = window.iwebLogger || createClientLogger('global');
}

export default createClientLogger;
