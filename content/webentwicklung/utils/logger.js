/**
 * Logger System - Zentrales Logging mit Log-Level Management
 *
 * Features:
 * - Kategorisierte Logger per Modul (createLogger)
 * - Konfigurierbare Log-Level (error, warn, info, debug)
 * - Globale und individuelle Log-Level-Kontrolle
 * - Performance-optimiert (minimaler Overhead bei deaktivierten Leveln)
 * - Debug-freundlich mit aussagekräftigen Prefixes
 *
 * @author Portfolio System
 * @version 1.0.0
 * @created 2025-10-02
 */

// Log-Level Definitionen
const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

// Globales Log-Level (kann zur Laufzeit geändert werden)
let globalLogLevel = LOG_LEVELS.warn;

/**
 * Setzt das globale Log-Level
 * @param {string} level - 'error', 'warn', 'info', 'debug'
 */
export function setGlobalLogLevel(level) {
  if (level in LOG_LEVELS) {
    globalLogLevel = LOG_LEVELS[level];
  }
}

/**
 * Erstellt einen Logger für ein spezifisches Modul
 * @param {string} moduleName - Name des Moduls
 * @returns {Object} Logger-Objekt mit error, warn, info, debug Methoden
 */
/**
 * Erstellt einen kategorisierten Logger für ein Modul
 * @param {string} category - Logger-Kategorie (z.B. "main", "particles")
 * @returns {Object} Logger-Objekt mit error, warn, info, debug Methoden
 */
export function createLogger(category) {
  const prefix = `[${category}]`;

  return {
    error: (message, ...args) => {
      if (globalLogLevel >= LOG_LEVELS.error) {
        console.error(prefix, message, ...args);
      }
    },

    warn: (message, ...args) => {
      if (globalLogLevel >= LOG_LEVELS.warn) {
        console.warn(prefix, message, ...args);
      }
    },

    info: (message, ...args) => {
      if (globalLogLevel >= LOG_LEVELS.info) {
        console.info(prefix, message, ...args);
      }
    },

    debug: (message, ...args) => {
      if (globalLogLevel >= LOG_LEVELS.debug) {
        console.log(prefix, message, ...args);
      }
    },
  };
}

/**
 * Standard-Logger für schnelle Verwendung
 */
export const log = createLogger("app");

// Debug-Modus basierend auf URL-Parameter oder localStorage
if (typeof window !== "undefined") {
  const urlParams = new URLSearchParams(window.location.search);
  const debugParam = urlParams.get("debug");
  const debugStorage = window.localStorage?.getItem("iweb-debug");

  if (debugParam === "true" || debugStorage === "true") {
    setGlobalLogLevel("debug");
  }
}
