import { getElementById } from '../webentwicklung/utils/common-utils.js';
import { initHeroFeatureBundle } from '../../pages/home/hero-manager.js';
import { createLogger, setGlobalLogLevel } from './utils/logger.js';

// ===== Globale Konfiguration =====
setGlobalLogLevel('warn');
const log = createLogger('main');

// ===== Accessibility Utilities =====
function announce(message, { assertive = false } = {}) {
  try {
    const id = assertive ? 'live-region-assertive' : 'live-region-status';
    const region = document.getElementById(id);
    if (!region) return;
    region.textContent = '';
    requestAnimationFrame(() => { region.textContent = message; });
  } catch {
    /* Fail silently */
  }
}
window.announce = window.announce || announce;
// ===== Section Loader Module =====
const SectionLoader = (() => {
  if (window.SectionLoader) return window.SectionLoader;

  const SELECTOR = 'section[data-section-src]';
  const SEEN = new WeakSet();

  async function loadInto(section) {
    if (SEEN.has(section)) return;
    SEEN.add(section);
    
    const url = section.getAttribute('data-section-src');
    if (!url) { 
      section.removeAttribute('aria-busy'); 
      return; 
    }

    section.setAttribute('aria-busy', 'true');
    section.dataset.state = 'loading';
    
    const labelId = section.getAttribute('aria-labelledby');
    let sectionName = '';
    if (labelId) { 
      const lbl = document.getElementById(labelId); 
      sectionName = lbl ? lbl.textContent.trim() : ''; 
    }
    if (!sectionName) sectionName = section.id || 'Abschnitt';
    
    announce(`Lade Abschnitt ${sectionName}…`);
    
    try {
      const res = await fetch(url, { credentials: 'same-origin' });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText} @ ${url}`);
      
      const html = await res.text();
      section.insertAdjacentHTML('beforeend', html);
      
      const tpl = section.querySelector('template');
      if (tpl) section.appendChild(tpl.content.cloneNode(true));
      
      section.querySelectorAll('.section-skeleton').forEach(n => n.remove());
      section.dataset.state = 'loaded';
      announce(`Abschnitt ${sectionName} geladen.`);
      
      if (section.id === 'hero') {
        document.dispatchEvent(new CustomEvent('hero:loaded'));
      }
    } catch (err) {
      log.error('SectionLoader:', err);
      section.dataset.state = 'error';
      announce(`Fehler beim Laden von Abschnitt ${sectionName}.`, { assertive: true });
    } finally {
      section.removeAttribute('aria-busy');
    }
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

    // Home/Hero Feature-Bundle initialisieren
    initHeroFeatureBundle();

    // Menü-Assets laden
    loadMenuAssets();

    // Hard fallback für Loading
    setTimeout(hideLoading, 5000);
  });
})();