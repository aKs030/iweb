import { getElementById } from '../webentwicklung/utils/common-utils.js';
import { initHeroFeatureBundle } from '../../pages/home/hero-manager.js';
import { createLogger, setGlobalLogLevel } from './utils/logger.js';
import { EVENTS, fire } from './utils/events.js';
import { EnhancedAnimationEngine } from './animations/enhanced-animation-engine.js';
import getSnapScrollInstance from './animations/snap-scroll-animations.js';

// ===== Globale Konfiguration =====
// Dynamisches Log-Level: URL Param ?log=debug oder localStorage LOG_LEVEL
(() => {
  try {
    const params = new URLSearchParams(location.search);
    const urlLevel = params.get('log');
    const stored = localStorage.getItem('LOG_LEVEL');
    const lvl = urlLevel || stored || 'warn';
    setGlobalLogLevel(lvl);
  } catch {
    setGlobalLogLevel('warn');
  }
})();
const log = createLogger('main');

// ===== Accessibility Utilities =====
function announce(message, { assertive = false } = {}) {
  try {
    const id = assertive ? 'live-region-assertive' : 'live-region-status';
    const region = getElementById(id);
    if (!region) return;
    region.textContent = '';
    requestAnimationFrame(() => { region.textContent = message; });
  } catch {
    /* Fail silently */
  }
}
// Snap Scroll Animations jetzt ausgelagert -> ./animations/snap-scroll-animations.js
const _SnapScrollAnimations = getSnapScrollInstance();

window.announce = window.announce || announce;
// ===== Section Loader Module =====
const SectionLoader = (() => {
  if (window.SectionLoader) return window.SectionLoader;

  const SELECTOR = 'section[data-section-src]';
  const SEEN = new WeakSet();

  /**
   * Lädt dynamisch den HTML-Inhalt einer Section per data-section-src.
   * Retry (1 zusätzlicher Versuch) bei transienten Fehlern (5xx / offline) + Timeout (8s) mit AbortController.
   * Reduzierte Komplexität durch Helper-Funktionen.
   * @param {HTMLElement} section
   */
  async function loadInto(section) {
    if (SEEN.has(section)) return;
    SEEN.add(section);
    const url = section.getAttribute('data-section-src');
    if (!url) { section.removeAttribute('aria-busy'); return; }

    prepSectionForLoad(section);
    const sectionName = resolveSectionName(section);
    announce(`Lade Abschnitt ${sectionName}…`);

    const maxAttempts = 2;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const result = await attemptFetchInsert(url, section);
      if (result.ok) {
        finalizeSuccess(section, sectionName);
        return;
      }
      const { error, transient } = result;
      log.warn('SectionLoader Versuch fehlgeschlagen', { attempt: attempt + 1, transient, error });
      if (error?.name === 'AbortError') log.warn('SectionLoader Timeout', { url });
      const last = attempt === maxAttempts - 1;
      if (last || !transient) {
        finalizeError(section, sectionName);
        return;
      }
      await backoff(attempt);
    }
    section.removeAttribute('aria-busy');
  }

  /** Bereitet Section DOM-State für Ladevorgang vor (ARIA + Status) */
  function prepSectionForLoad(section) {
    section.setAttribute('aria-busy', 'true');
    section.dataset.state = 'loading';
  }

  /** Ermittelt sprechbaren Section-Namen (für Announce) */
  function resolveSectionName(section) {
    const labelId = section.getAttribute('aria-labelledby');
    if (labelId) {
      const lbl = document.getElementById(labelId);
      const txt = lbl?.textContent?.trim();
      if (txt) return txt;
    }
    return section.id || 'Abschnitt';
  }

  /**
   * Einzelner Fetch-Versuch mit optionalem Timeout + DOM Insertion.
   * @returns {Promise<{ok:true}|{ok:false,error:any,transient:boolean}>}
   */
  async function attemptFetchInsert(url, section) {
    const AC = globalThis.AbortController;
    let controller, timeout;
    try {
      if (AC) { controller = new AC(); timeout = setTimeout(() => controller.abort(), 8000); }
      const res = await fetch(url, { credentials: 'same-origin', signal: controller?.signal });
      if (timeout) clearTimeout(timeout);
      if (!res.ok) throw new Error(`${res.status} ${res.statusText} @ ${url}`);
      const html = await res.text();
      section.insertAdjacentHTML('beforeend', html);
      const tpl = section.querySelector('template');
      if (tpl) section.appendChild(tpl.content.cloneNode(true));
      section.querySelectorAll('.section-skeleton').forEach(n => n.remove());
      section.dataset.state = 'loaded';
      if (section.id === 'hero') fire(EVENTS.HERO_LOADED);
      return { ok: true };
    } catch (error) {
      const transient = (error && /5\d\d/.test(String(error))) || (error && navigator.onLine === false);
      if (timeout) clearTimeout(timeout);
      return { ok: false, error, transient };
    } finally {
      if (section.dataset.state === 'loaded') section.removeAttribute('aria-busy');
    }
  }

  /** Abschluss bei Erfolg (Announce) */
  function finalizeSuccess(section, sectionName) {
    announce(`Abschnitt ${sectionName} geladen.`);
  }

  /** Abschluss bei Fehler (Announce + Status) */
  function finalizeError(section, sectionName) {
    section.dataset.state = 'error';
    section.removeAttribute('aria-busy');
    announce(`Fehler beim Laden von Abschnitt ${sectionName}.`, { assertive: true });
  }

  /** Exponentiell leicht wachsender Backoff */
  function backoff(attempt) {
    return new Promise(r => setTimeout(r, 300 + (attempt + 1) * 200));
  }

  function init() {
    const sections = Array.from(document.querySelectorAll(SELECTOR));
    const lazy = [];
    
    sections.forEach(section => {
      if (section.hasAttribute('data-eager')) {
        loadInto(section);
      } else {
        lazy.push(section);
      }
    });
    
    if (lazy.length) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const s = entry.target;
            loadInto(s);
            io.unobserve(s);
          }
        });
      });
      lazy.forEach(s => io.observe(s));
    }
  }

  const api = { init, loadInto };
  window.SectionLoader = api;
  return api;
})();

// Section Loader initialisieren
if (document.readyState !== 'loading') {
  SectionLoader.init();
} else {
  document.addEventListener('DOMContentLoaded', SectionLoader.init);
}

// ===== Scroll Snapping Module =====
const ScrollSnapping = (() => {
  let snapTimer = null;
  const snapContainer = document.querySelector('.snap-container') || document.documentElement;
  
  const disableSnap = () => snapContainer.classList.add('no-snap');
  const enableSnap = () => snapContainer.classList.remove('no-snap');
  
  const onActiveScroll = () => {
    disableSnap();
    clearTimeout(snapTimer);
    snapTimer = setTimeout(enableSnap, 180);
  };

  function init() {
    addEventListener('wheel', onActiveScroll, { passive: true });
    addEventListener('touchmove', onActiveScroll, { passive: true });
    addEventListener('keydown', (e) => {
      if (['PageDown', 'PageUp', 'Home', 'End', 'ArrowDown', 'ArrowUp', 'Space'].includes(e.key)) {
        onActiveScroll();
      }
    });
  }

  return { init };
})();

// Scroll Snapping initialisieren
ScrollSnapping.init();


// ===== Menu Loading =====
function loadMenuAssets() {
  const c = getElementById('menu-container');
  if (!c) return;
  if (c.dataset.assetsLoaded === '1') return;
  if (document.querySelector('script[src="/content/webentwicklung/menu/menu.js"]')) {
    c.dataset.assetsLoaded = '1';
    return;
  }
  const s = document.createElement('script');
  s.src = '/content/webentwicklung/menu/menu.js';
  s.defer = true;
  s.onload = () => { c.dataset.assetsLoaded = '1'; };
  document.body.appendChild(s);
}

// ===== Application Initialization =====
(() => {
  'use strict';

  // Loading State Management
  let __modulesReady = false, __windowLoaded = false, __start = 0;
  const __MIN = 700;

  function hideLoading() {
    const el = getElementById('loadingScreen');
    if (!el) return;
    
    el.classList.add('hide');
    el.setAttribute('aria-hidden', 'true');
    Object.assign(el.style, { 
      opacity: '0', 
      pointerEvents: 'none', 
      visibility: 'hidden' 
    });
    
    const rm = () => {
      el.style.display = 'none';
      el.removeEventListener('transitionend', rm);
    };
    el.addEventListener('transitionend', rm);
    setTimeout(rm, 700);
    announce('Initiales Laden abgeschlossen.');
  }

  // Main DOMContentLoaded Handler
  document.addEventListener('DOMContentLoaded', async () => {
    __start = performance.now();

    const tryHide = () => {
      if (!__modulesReady) return;
      if (!__windowLoaded && document.readyState !== 'complete') return;
      const elapsed = performance.now() - __start;
      setTimeout(hideLoading, Math.max(0, __MIN - elapsed));
    };

    addEventListener('load', () => { 
      __windowLoaded = true; 
      tryHide(); 
    }, { once: true });

    // Module als ready markieren
    __modulesReady = true;
    tryHide();

    // Enhanced Animation Engine initialisieren
    if (!window.enhancedAnimationEngine) {
      window.enhancedAnimationEngine = new EnhancedAnimationEngine();
      log.debug('Enhanced Animation Engine initialized');
    }

    // Home/Hero Feature-Bundle initialisieren
    initHeroFeatureBundle();

    // Snap-Scroll Animationen initialisieren (aus ausgelagertem Modul)
    _SnapScrollAnimations.init();

    // Re-scan nach Template-Loading
    document.addEventListener(EVENTS.FEATURES_TEMPLATES_LOADED, () => {
      setTimeout(() => _SnapScrollAnimations.rescan(), 120);
    });

    // Menü-Assets laden
    loadMenuAssets();

    // Hard fallback für Loading
    setTimeout(hideLoading, 5000);
  });
})();

// ===== Custom Event Übersicht =====
// hero:loaded             -> Hero Section HTML fertig geladen (SectionLoader)
// hero:typingEnd          -> Typing Effekt beendet (Hero Typing Modul)
// featuresTemplatesLoaded -> Feature Karten Templates (Rotation) sind verfügbar
// template:mounted        -> Neues Feature Template wurde in Section eingesetzt
// features:change         -> Feature Rotation hat ein anderes Template aktiviert
// (intern) snapSectionChange -> Snap Scroll / Navigation hat sichtbare Sektion geändert
// Diese Events ermöglichen lose Kopplung zwischen Lazy-Loaded Sektionen, Animation Engine und UI.