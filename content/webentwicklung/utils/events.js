/**
 * Zentrales Modul für Custom Event Namen & Helper.
 * Vorteile:
 *  - Autocomplete & Vermeidung von Tippfehlern
 *  - Single Source of Truth für Erweiterung / Dokumentation
 *  - Einheitliche Fire/Listen API
 * Konvention: lowercase mit Doppelpunkten für Namespacing (hero:loaded)
 */

import { createLogger } from './logger.js';

const log = createLogger('events');

export const EVENTS = Object.freeze({
  HERO_LOADED: 'hero:loaded',
  HERO_TYPING_END: 'hero:typingEnd',
  FEATURES_TEMPLATES_LOADED: 'featuresTemplatesLoaded',
  FEATURES_TEMPLATES_ERROR: 'featuresTemplatesError',
  TEMPLATE_MOUNTED: 'template:mounted',
  FEATURES_CHANGE: 'features:change',
  
  // Neue Events für koordinierte Initialisierung
  DOM_READY: 'app:domReady',
  CORE_INITIALIZED: 'app:coreInitialized',
  MODULES_READY: 'app:modulesReady',
  HERO_INIT_READY: 'app:heroInitReady'
});

/**
 * Hilfsfunktion zum Dispatche eines Custom Events mit Detail Payload.
 * @param {string} type - Event Name (aus EVENTS)
 * @param {any} [detail] - Optionale Daten
 * @param {EventTarget} [target=document] - Ziel (default document)
 */
export function fire(type, detail, target = document) {
  try {
    if (!target || typeof target.dispatchEvent !== 'function') {
      log.warn('fire(): target ist kein EventTarget', target);
      return;
    }
    target.dispatchEvent(new CustomEvent(type, { detail }));
  } catch (e) {
    // Fail-Safe: kein Throw ins UI
    log.warn('fire event error', type, e);
  }
}

/**
 * Convenience Listener Registrierung mit automatischem Rückgabe-Cleanup.
 * Optionales Options-Objekt (once, passive, capture) wie bei addEventListener.
 * @param {string} type
 * @param {(e:CustomEvent)=>void} handler
 * @param {EventTarget|Object} [target=document] - Muss addEventListener unterstützen
 * @param {Object} [options] - { once, passive, capture }
 * @returns {() => void} unsubscribe
 */
export function on(type, handler, options, target = document) {
  // Options-Objekt erkennen (3. oder 4. Parameter)
  let realTarget = target, opts = options;
  if (options && typeof options.addEventListener !== 'function' && typeof target.addEventListener !== 'function') {
    // options ist vermutlich das Options-Objekt, target fehlt
    opts = options;
    realTarget = document;
  } else if (options && typeof options.addEventListener === 'function') {
    // options ist tatsächlich das Target, target fehlt
    realTarget = options;
    opts = undefined;
  }
  if (!realTarget || typeof realTarget.addEventListener !== 'function') {
    log.warn('on(): target ist kein EventTarget', realTarget);
    return () => {};
  }
  realTarget.addEventListener(type, handler, opts);
  return () => realTarget.removeEventListener(type, handler, opts);
}
