import { getElementById } from './utils/common-utils.js';
import { initHeroFeatureBundle } from '../../pages/home/hero-manager.js';
import { EVENTS, fire } from './utils/events.js';
import { EnhancedAnimationEngine } from './animations/enhanced-animation-engine.js';
import { schedulePersistentStorageRequest } from './utils/persistent-storage.js';
import TypeWriterRegistry from './TypeWriter/TypeWriter.js';
import './utils/section-tracker.js'; // Section Detection für snapSectionChange Events

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

window.announce = window.announce || announce;

// ===== Service Worker Registrierung =====
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

// ===== Lazy Load nicht-kritischer Module =====
const _lazyModules = (() => {
  const MAP = [
    { id: 'features', module: '/pages/card/karten-rotation.js', loaded: false, type: 'feature-rotation' },
    { id: 'about', module: '/pages/about/about.js', loaded: false, type: 'about-section' }
  ];
  if (!('IntersectionObserver' in window)) {
    // Fallback: direkt laden
    MAP.forEach(entry => import(entry.module).catch(() => {}));
    return { observer: null };
  }
  const options = { root: null, threshold: 0.15, rootMargin: '120px 0px' };
  const io = new IntersectionObserver(entries => {
    for (const e of entries) {
      if (e.isIntersecting) {
        const match = MAP.find(m => m.id === e.target.id);
        if (match && !match.loaded) {
          match.loaded = true;
          import(match.module).catch(() => {});
          io.unobserve(e.target);
        }
      }
    }
  }, options);
  // Delay Setup bis DOMContentLoaded, Sections existieren initial (hero eager) andere werden dynamisch geladen.
  document.addEventListener('section:loaded', ev => {
    const id = ev.detail?.id;
    const candidate = MAP.find(m => m.id === id);
    if (candidate && !candidate.loaded) {
      const el = getElementById(id);
      if (el) io.observe(el);
    }
  });
  // Falls Features/About bereits im DOM (eager oder schnell geladen)
  ['features','about'].forEach(id => {
    const el = getElementById(id);
    if (el) io.observe(el);
  });
  return { observer: io };
})();
// ===== Section Loader Module =====
const SectionLoader = (() => {
  if (window.SectionLoader) return window.SectionLoader;

  const SELECTOR = 'section[data-section-src]';
  const SEEN = new WeakSet();

  // Dispatch Helper für konsistente CustomEvents
  function dispatchSectionEvent(type, section, detail = {}) {
    try {
      const ev = new CustomEvent(type, { detail: { id: section?.id, section, ...detail } });
      document.dispatchEvent(ev);
    } catch { /* ignore */ }
  }

  /**
   * Lädt dynamisch den HTML-Inhalt einer Section per data-section-src.
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
    dispatchSectionEvent('section:will-load', section, { url });

    const maxAttempts = 2;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const result = await attemptFetchInsert(url, section);
      if (result.ok) {
        finalizeSuccess(section, sectionName);
        return;
      }
      const { transient } = result;
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
      const lbl = getElementById(labelId);
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
      let html;
      const res = await fetch(url, { credentials: 'same-origin', signal: controller?.signal });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText} @ ${url}`);
      html = await res.text();
      if (timeout) clearTimeout(timeout);
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
    dispatchSectionEvent('section:loaded', section, { state: 'loaded' });
  }

  /** Abschluss bei Fehler (Announce + Status) */
  function finalizeError(section, sectionName) {
    section.dataset.state = 'error';
    section.removeAttribute('aria-busy');
    announce(`Fehler beim Laden von Abschnitt ${sectionName}.`, { assertive: true });
    dispatchSectionEvent('section:error', section, { state: 'error' });
    injectRetryUI(section);
  }

  /** Exponentiell leicht wachsender Backoff */
  function backoff(attempt) {
    return new Promise(r => setTimeout(r, 300 + (attempt + 1) * 200));
  }

  function init() {
    if (init._initialized) return; // idempotent
    init._initialized = true;
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

  function injectRetryUI(section) {
    if (section.querySelector('.section-retry')) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'section-retry';
    btn.textContent = 'Erneut laden';
    btn.addEventListener('click', () => retry(section), { once: true });
    const wrapper = document.createElement('div');
    wrapper.className = 'section-error-box';
    wrapper.append(btn);
    section.append(wrapper);
  }

  async function retry(section) {
    // Cleanup previous error UI
    section.querySelectorAll('.section-error-box').forEach(n => n.remove());
    section.dataset.state = '';
    section.setAttribute('aria-busy', 'true');
    SEEN.delete(section); // allow reprocessing
    await loadInto(section);
  }

  function reinit() {
    // Erlaubt bewusstes erneutes Scannen (z.B. nach dynamischem DOM-Replace)
    init._initialized = false;
    init();
  }

  const api = { init, reinit, loadInto, retry };
  window.SectionLoader = api;
  return api;
})();

// Section Loader initialisieren
if (document.readyState !== 'loading') {
  SectionLoader.init();
} else {
  // Wird vom zentralen DOMContentLoaded Handler aufgerufen
  document.addEventListener(EVENTS.DOM_READY, SectionLoader.init);
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
  const __MIN = 600; // Mindestzeit für Loading Screen

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

  // Zentraler DOMContentLoaded Handler - koordiniert alle Module
  document.addEventListener('DOMContentLoaded', async () => {
    __start = performance.now();

    // 1. DOM Ready Event für andere Module
    fire(EVENTS.DOM_READY);

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

    // 2. Kern-Module initialisieren
    // Enhanced Animation Engine initialisieren
    if (!window.enhancedAnimationEngine) {
      window.enhancedAnimationEngine = new EnhancedAnimationEngine();
    }
    
    // TypeWriter Registry global verfügbar machen
    if (!window.TypeWriterRegistry) {
      window.TypeWriterRegistry = TypeWriterRegistry;
    }
    
    fire(EVENTS.CORE_INITIALIZED);

    // === Mobile Performance Optimierung (nach Engine-Init) ===
    const isMobile = window.matchMedia('(max-width: 600px), (pointer: coarse)').matches;
    if (isMobile && window.enhancedAnimationEngine) {
      window.enhancedAnimationEngine.options.maxAnimations = 3;
      window.enhancedAnimationEngine.options.threshold = 0.1;
      window.enhancedAnimationEngine.setRepeatOnScroll(false);
    }

    // 3. Hero Feature-Bundle initialisieren
    fire(EVENTS.HERO_INIT_READY);
    initHeroFeatureBundle();

    // 4. Module als ready markieren
    __modulesReady = true;
    fire(EVENTS.MODULES_READY);
    tryHide();

    // Re-scan nach Template-Loading für Enhanced Animation Engine
    document.addEventListener(EVENTS.FEATURES_TEMPLATES_LOADED, () => {
      // Animation Engine rescan für neue Templates
      if (window.enhancedAnimationEngine?.scan) {
        setTimeout(() => window.enhancedAnimationEngine.scan(), 120);
      }
    });

    // Menü-Assets laden
    loadMenuAssets();

    // Hard fallback für Loading
    setTimeout(hideLoading, 5000);

    // Persistenten Storage anfragen (best effort, verzögert um Initial Load nicht zu blockieren)
    schedulePersistentStorageRequest(2200);
  }, { once: true });
})();