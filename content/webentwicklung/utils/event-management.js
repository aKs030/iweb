/**
 * Event Management Utilities - Vereinheitlichte Event-Listener Patterns
 * 
 * Bietet standardisierte Event-Management Patterns mit automatischem Cleanup:
 * - Event Listener Registration mit automatischem removeEventListener
 * - Batch Event Setup für mehrere Listener
 * - Lifecycle-aware Event Management (cleanup bei beforeunload/visibilitychange)
 * - Passive Event Listeners für Performance
 * 
 * @author Portfolio System
 * @version 1.0.0
 * @created 2025-10-02
 */

import { createLogger } from "./logger.js";

const log = createLogger("eventManagement");

// ===== Event Listener Manager =====

/**
 * Event Listener Manager für systematisches Event-Management
 */
export class EventListenerManager {
  constructor(name = "anonymous") {
    this.name = name;
    this.listeners = new Set();
    this.isDestroyed = false;
  }

  /**
   * Fügt einen Event Listener hinzu mit automatischem Cleanup
   * @param {EventTarget} target - Event Target (element, window, document)
   * @param {string} event - Event Name
   * @param {Function} handler - Event Handler
   * @param {Object|boolean} options - Event Options oder useCapture
   * @returns {Function} removeListener Funktion
   */
  add(target, event, handler, options = {}) {
    if (this.isDestroyed) {
      log.warn(`${this.name}: Versuch Listener zu ${event} hinzuzufügen nach destroy`);
      return () => {};
    }

    if (!target || typeof target.addEventListener !== 'function') {
      log.warn(`${this.name}: Ungültiges Event Target für ${event}`, target);
      return () => {};
    }

    // Normalisiere options
    const normalizedOptions = typeof options === 'boolean' ? { capture: options } : options;
    
    // Standard Performance-Optimierungen
    const finalOptions = {
      passive: true, // Default für bessere Performance
      ...normalizedOptions
    };

    try {
      target.addEventListener(event, handler, finalOptions);
      
      const listenerInfo = { target, event, handler, options: finalOptions };
      this.listeners.add(listenerInfo);

      // Rückgabe-Funktion für einzelnen Cleanup
      return () => this.remove(target, event, handler);
      
    } catch (error) {
      log.error(`${this.name}: Fehler beim Hinzufügen von ${event} Listener:`, error);
      return () => {};
    }
  }

  /**
   * Entfernt spezifischen Event Listener
   * @param {EventTarget} target 
   * @param {string} event 
   * @param {Function} handler 
   */
  remove(target, event, handler) {
    const listenerToRemove = Array.from(this.listeners).find(
      l => l.target === target && l.event === event && l.handler === handler
    );

    if (listenerToRemove) {
      try {
        target.removeEventListener(event, handler, listenerToRemove.options);
        this.listeners.delete(listenerToRemove);
      } catch (error) {
        log.warn(`${this.name}: Fehler beim Entfernen von ${event} Listener:`, error);
      }
    }
  }

  /**
   * Batch-Setup für mehrere Event Listener
   * @param {Array} listenerConfigs - Array von {target, event, handler, options}
   * @returns {Function} removeAll Funktion
   */
  addBatch(listenerConfigs) {
    const removeFunctions = listenerConfigs.map(config => 
      this.add(config.target, config.event, config.handler, config.options)
    );

    return () => removeFunctions.forEach(fn => fn());
  }

  /**
   * Cleanup aller registrierten Listener
   */
  removeAll() {
    this.listeners.forEach(({ target, event, handler, options }) => {
      try {
        target.removeEventListener(event, handler, options);
      } catch (error) {
        log.warn(`${this.name}: Cleanup Fehler für ${event}:`, error);
      }
    });
    
    this.listeners.clear();
  }

  /**
   * Zerstört den Manager und bereinigt alle Listener
   */
  destroy() {
    this.removeAll();
    this.isDestroyed = true;
  }

  /**
   * Gibt die Anzahl aktiver Listener zurück
   */
  get size() {
    return this.listeners.size;
  }
}

// ===== Convenience Functions =====

/**
 * Erstellt einen Event Listener Manager mit automatischem beforeunload cleanup
 * @param {string} name - Name für Debugging
 * @param {boolean} autoCleanup - Automatischer cleanup bei beforeunload
 * @returns {EventListenerManager}
 */
export function createEventManager(name = "manager", autoCleanup = true) {
  const manager = new EventListenerManager(name);
  
  if (autoCleanup && typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
      manager.destroy();
    }, { once: true });
  }
  
  return manager;
}

/**
 * Convenience Funktion für Single Event Listener mit Cleanup
 * @param {EventTarget} target 
 * @param {string} event 
 * @param {Function} handler 
 * @param {Object} options 
 * @returns {Function} cleanup Funktion
 */
export function addListener(target, event, handler, options = {}) {
  if (!target || typeof target.addEventListener !== 'function') {
    log.warn('addListener: Ungültiges Event Target', target);
    return () => {};
  }

  const finalOptions = { passive: true, ...options };
  
  try {
    target.addEventListener(event, handler, finalOptions);
    return () => target.removeEventListener(event, handler, finalOptions);
  } catch (error) {
    log.error('addListener: Event Setup Fehler:', error);
    return () => {};
  }
}

/**
 * Batch Event Setup für Objekte mit mehreren Events
 * @param {EventTarget} target 
 * @param {Object} eventMap - { eventName: handler, ... }
 * @param {Object} defaultOptions 
 * @returns {Function} cleanup aller Events
 */
export function addEventMap(target, eventMap, defaultOptions = {}) {
  const cleanupFunctions = [];
  
  Object.entries(eventMap).forEach(([event, handler]) => {
    const cleanup = addListener(target, event, handler, defaultOptions);
    cleanupFunctions.push(cleanup);
  });
  
  return () => cleanupFunctions.forEach(fn => fn());
}

// ===== Lifecycle Event Helpers =====

/**
 * Setup für visibilitychange Event mit Performance-Optimierungen
 * @param {Function} callback - (isVisible) => void
 * @returns {Function} cleanup
 */
export function onVisibilityChange(callback) {
  if (typeof document === 'undefined') return () => {};
  
  const handler = () => callback(!document.hidden);
  return addListener(document, 'visibilitychange', handler, { passive: true });
}

/**
 * Setup für beforeunload Event mit Cleanup-Callback
 * @param {Function} callback - Cleanup Funktion
 * @returns {Function} cleanup
 */
export function onBeforeUnload(callback) {
  if (typeof window === 'undefined') return () => {};
  
  return addListener(window, 'beforeunload', callback, { once: true });
}

// ===== Common Event Patterns =====

/**
 * Standard Mouse/Touch Event Setup für Pointer-Interaktionen
 * @param {Element} element 
 * @param {Object} handlers - { onStart, onMove, onEnd }
 * @param {Object} options 
 * @returns {Function} cleanup
 */
export function setupPointerEvents(element, { onStart, onMove, onEnd }, options = {}) {
  const eventManager = new EventListenerManager('pointerEvents');
  
  const handlePointerDown = (e) => {
    if (onStart) onStart(e);
  };
  
  const handlePointerMove = (e) => {
    if (onMove) onMove(e);
  };
  
  const handlePointerUp = (e) => {
    if (onEnd) onEnd(e);
  };

  // Mouse Events
  eventManager.add(element, 'mousedown', handlePointerDown, { passive: false, ...options });
  eventManager.add(element, 'mousemove', handlePointerMove, { passive: true, ...options });
  eventManager.add(element, 'mouseup', handlePointerUp, { passive: true, ...options });
  eventManager.add(element, 'mouseleave', handlePointerUp, { passive: true, ...options });

  // Touch Events
  eventManager.add(element, 'touchstart', handlePointerDown, { passive: false, ...options });
  eventManager.add(element, 'touchmove', handlePointerMove, { passive: true, ...options });
  eventManager.add(element, 'touchend', handlePointerUp, { passive: true, ...options });

  return () => eventManager.destroy();
}

/**
 * Standard Resize Event Setup mit Debouncing
 * @param {Function} callback 
 * @param {number} delay - Debounce delay in ms
 * @returns {Function} cleanup
 */
export function onResize(callback, delay = 100) {
  if (typeof window === 'undefined') return () => {};
  
  let timeoutId;
  const debouncedHandler = () => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(callback, delay);
  };
  
  const cleanup = addListener(window, 'resize', debouncedHandler, { passive: true });
  
  return () => {
    clearTimeout(timeoutId);
    cleanup();
  };
}

/**
 * Standard Scroll Event Setup mit Throttling
 * @param {Function} callback 
 * @param {Element|Window} target 
 * @param {number} throttleMs - Throttle interval in ms
 * @returns {Function} cleanup
 */
export function onScroll(callback, target = window, throttleMs = 16) {
  let lastCall = 0;
  
  const throttledHandler = () => {
    const now = Date.now();
    if (now - lastCall >= throttleMs) {
      lastCall = now;
      callback();
    }
  };
  
  return addListener(target, 'scroll', throttledHandler, { passive: true });
}

// ===== Debug Utilities =====

/**
 * Loggt aktive Event Listener für Debugging
 * @param {EventListenerManager} manager 
 */
export function debugEventManager(manager) {
  if (log.isDebugEnabled()) {
    log.debug(`${manager.name} Event Manager:`, {
      activeListeners: manager.size,
      listeners: Array.from(manager.listeners).map(l => ({
        target: l.target.tagName || l.target.constructor.name,
        event: l.event,
        passive: l.options.passive
      }))
    });
  }
}