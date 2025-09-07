import { throttle, prefersReducedMotion, getElementById } from '../webentwicklung/utils/common-utils.js';
import { initParticles as _initParticles } from './particles/particle-system.js';
import { EnhancedAnimationEngine } from './animations/enhanced-animation-engine.js';
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

// ===== Hero Management Module =====
const HeroManager = (() => {
  let TypeWriter = null, makeLineMeasurer = null, quotes = [], heroData = null;
  const getElement = getElementById;

  async function loadTyped() {
    const modules = [
      ['../../pages/home/TypeWriter.js', m => { TypeWriter = m.default; }],
      ['../../pages/home/lineMeasurer.js', m => { makeLineMeasurer = m.makeLineMeasurer; }],
      ['../../pages/home/quotes-de.js', m => { quotes = m.default || m.quotes; }],
    ];
    
    for (const [path, handler] of modules) {
      try {
        const module = await import(path);
        handler(module);
      } catch (error) {
        log.warn(`Failed to load module ${path}:`, error);
      }
    }
  }

  function initLazyHeroModules() {
    let loaded = false;
    const triggerLoad = async () => {
      if (loaded) return;
      loaded = true;
      await loadTyped();
      setRandomGreetingHTML();
    };

    const heroEl = getElement('hero') || document.querySelector('section#hero');
    if (!heroEl) {
      setTimeout(triggerLoad, 2500);
      return;
    }

    // Falls schon im Viewport
    const rect = heroEl.getBoundingClientRect();
    if (rect.top < innerHeight && rect.bottom > 0) {
      triggerLoad();
      return;
    }

    const obs = new IntersectionObserver(entries => {
      for (const e of entries) {
        if (e.isIntersecting) {
          obs.disconnect();
          triggerLoad();
          break;
        }
      }
    }, {});
    obs.observe(heroEl);

    // Safety Timeout
    setTimeout(triggerLoad, 6000);
  }

  const ensureHeroData = async () => heroData || (heroData = await import('../../pages/home/hero-data.js').catch(() => ({})));

  async function setRandomGreetingHTML(animated = false) {
    const delays = [0, 50, 120, 240, 480];
    let el = null;
    
    for (const d of delays) {
      if (d) await new Promise(r => setTimeout(r, d));
      el = getElement('greetingText');
      if (el) break;
    }
    if (!el) return;

    const mod = await ensureHeroData();
    const set = mod.getGreetingSet ? mod.getGreetingSet() : [];
    const next = mod.pickGreeting ? mod.pickGreeting(el.dataset.last, set) : '';
    if (!next) return;
    
    el.dataset.last = next;
    if (animated) {
      el.classList.add('fade');
      setTimeout(() => { 
        el.textContent = next; 
        el.classList.remove('fade'); 
      }, 360);
    } else {
      el.textContent = next;
    }
  }

  // Typing-Initialisierung für externe Verwendung
  window.__initTyping = async () => {
    if (!TypeWriter || !makeLineMeasurer || !quotes.length) {
      await loadTyped();
    }

    const module = await import('../../pages/home/TypeWriter.js');
    return (typeof module.initHeroSubtitle === 'function')
      ? module.initHeroSubtitle({
        ensureHeroDataModule: ensureHeroData,
        makeLineMeasurer,
        quotes,
        TypeWriterClass: TypeWriter
      })
      : false;
  };

  return { 
    initLazyHeroModules, 
    setRandomGreetingHTML, 
    ensureHeroData 
  };
})();

// ===== Particles Module =====
const ParticlesManager = (() => {
  const getElement = getElementById;
  
  const initParticles = () => {
    const canvas = getElement('particleCanvas');
    if (!canvas) {
      log.warn('Particle canvas not found');
      return () => {};
    }
    return _initParticles({ getElement, throttle, checkReducedMotion: prefersReducedMotion });
  };

  return { initParticles };
})();

// ===== Event Handlers =====
const EventHandlers = (() => {
  function setupHeroEvents() {
    document.addEventListener('hero:loaded', () => {
      const el = getElementById('greetingText');
      if (!el) return;
      if (!el.textContent.trim() || el.textContent.trim() === 'Willkommen') {
        HeroManager.setRandomGreetingHTML();
        announce('Hero Bereich bereit.');
      }
    });

    document.addEventListener('DOMContentLoaded', () => {
      const el = getElementById('greetingText');
      if (!el) return;
      if (!el.textContent.trim()) {
        HeroManager.setRandomGreetingHTML();
      }
    }, { once: true });

    document.addEventListener('hero:typingEnd', (e) => {
      const text = e.detail?.text || 'Text';
      announce(`Zitat vollständig: ${text}`);
    });

    document.addEventListener('features:change', (e) => {
      const d = e.detail || {};
      if (typeof d.index === 'number' && typeof d.total === 'number') {
        announce(`Feature ${d.index + 1} von ${d.total}`);
      }
    });
  }

  return { setupHeroEvents };
})();

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

    // Event-Handler einrichten
    EventHandlers.setupHeroEvents();

    // Lazy Loading Hero Module initialisieren
    HeroManager.initLazyHeroModules();

    // Particles mit Verzögerung
    setTimeout(() => {
      try {
        const stopParticles = ParticlesManager.initParticles();
        window.__stopParticles = stopParticles;
      } catch (error) {
        log.warn('Particle system initialization failed:', error);
      }
    }, 100);

    // Animation Engine initialisieren
    setTimeout(() => {
      try {
        const hero = getElementById('hero');
        if (!hero) return;

        if (!window.enhancedAnimationEngine) {
          window.enhancedAnimationEngine = new EnhancedAnimationEngine();
          console.warn('✅ Enhanced Animation Engine initialized');
        }

        // Animation-Scans
        const scanAnimations = () => window.enhancedAnimationEngine.scan?.();
        
        scanAnimations();
        setTimeout(scanAnimations, 1000);
        
        // Event-Listener für dynamische Inhalte
        document.addEventListener('featuresTemplatesLoaded', () => {
          setTimeout(scanAnimations, 100);
        });
        
        document.addEventListener('features:change', () => {
          setTimeout(scanAnimations, 100);
        });

        // Hero-Button-Animationen aktivieren
        hero.querySelectorAll('.hero-buttons [data-animation="crt"].animate-element:not(.is-visible)')
          ?.forEach(b => b.classList.add('is-visible'));
      } catch (error) {
        log.warn('Hero animations failed:', error);
      }
    }, 420);

    // Menü-Assets laden
    loadMenuAssets();

    // Hard fallback für Loading
    setTimeout(hideLoading, 5000);
  });
})();