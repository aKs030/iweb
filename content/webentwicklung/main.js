import { getElementById, prefersReducedMotion } from '../webentwicklung/utils/common-utils.js';
import { initHeroFeatureBundle } from '../../pages/home/hero-manager.js';
import { createLogger, setGlobalLogLevel } from './utils/logger.js';
import { EnhancedAnimationEngine } from './animations/enhanced-animation-engine.js';

// ===== Globale Konfiguration =====
setGlobalLogLevel('warn');
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
// ===== Snap-Scroll Karten-Animationen =====
const _SnapScrollAnimations = (() => {
  let observer = null;
  const animatedSections = new WeakSet();
  const REDUCED_MOTION = prefersReducedMotion();
  
  const CONFIG = {
    threshold: 0.3,
    rootMargin: '-10% 0px -10% 0px',
    staggerDelay: 150,
    cardDuration: 600,
  };

  function animateCard(card, delay) {
    if (REDUCED_MOTION) {
      card.classList.add('scroll-animated');
      return;
    }
    
    card.style.transform = 'translateY(30px) scale(0.9)';
    card.style.opacity = '0';
    card.style.transition = '';
    
    setTimeout(() => {
      card.style.transition = `transform ${CONFIG.cardDuration}ms cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity ${CONFIG.cardDuration}ms ease-out`;
      card.style.transform = 'translateY(0) scale(1)';
      card.style.opacity = '1';
      
      setTimeout(() => {
        card.classList.add('scroll-animated');
      }, CONFIG.cardDuration);
    }, delay);
  }

  function animateCards(container) {
    const cards = container.querySelectorAll('.card');
    cards.forEach((card, index) => {
      animateCard(card, index * CONFIG.staggerDelay);
    });
    
    if (!REDUCED_MOTION) {
      const totalDuration = cards.length * CONFIG.staggerDelay + CONFIG.cardDuration;
      setTimeout(() => {
        container.classList.add('animations-complete');
      }, totalDuration);
    } else {
      container.classList.add('animations-complete');
    }
  }

  function animateHeader(header) {
    if (REDUCED_MOTION) return;
    
    header.style.transform = 'translateY(-20px)';
    header.style.opacity = '0';
    header.style.transition = '';
    
    requestAnimationFrame(() => {
      header.style.transition = 'transform 500ms cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 500ms ease-out';
      header.style.transform = 'translateY(0)';
      header.style.opacity = '1';
    });
  }

  function handleIntersection(entries) {
    entries.forEach(entry => {
      const section = entry.target;
      
      if (entry.isIntersecting && entry.intersectionRatio >= CONFIG.threshold) {
        if (animatedSections.has(section)) return;
        animatedSections.add(section);
        
        log.debug('Snap-scroll animation triggered', { id: section.id });
        
        const header = section.querySelector('.section-header');
        if (header) {
          animateHeader(header);
        }
        
        const cardsContainer = section.querySelector('.features-cards');
        if (cardsContainer) {
          setTimeout(() => animateCards(cardsContainer), 200);
        }
        
        const title = section.querySelector('.section-title')?.textContent || 'Section';
        announce(`${title} Abschnitt animiert`);
      }
    });
  }

  function init() {
    if (observer) return;
    
    log.debug('Initializing snap-scroll card animations');
    
    observer = new IntersectionObserver(handleIntersection, {
      threshold: [0, CONFIG.threshold, 0.5, 1],
      rootMargin: CONFIG.rootMargin
    });
    
    const sections = document.querySelectorAll('.full-screen-section, [data-scroll-animate]');
    sections.forEach(section => {
      const hasCards = section.querySelector('.features-cards');
      if (hasCards) {
        observer.observe(section);
        log.debug('Observing section for snap-scroll animations', { id: section.id || 'unnamed' });
      }
    });
  }

  function rescan() {
    if (!observer) return;
    
    const sections = document.querySelectorAll('.full-screen-section, [data-scroll-animate]');
    sections.forEach(section => {
      const hasCards = section.querySelector('.features-cards');
      if (hasCards && !animatedSections.has(section)) {
        observer.observe(section);
        log.debug('Added new section to snap-scroll observer', { id: section.id || 'unnamed' });
      }
    });
  }

  return { init, rescan };
})();

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

    // Enhanced Animation Engine initialisieren
    if (!window.enhancedAnimationEngine) {
      window.enhancedAnimationEngine = new EnhancedAnimationEngine();
      log.debug('Enhanced Animation Engine initialized');
    }

    // Home/Hero Feature-Bundle initialisieren
    initHeroFeatureBundle();

    // Snap-Scroll Animationen initialisieren
    _SnapScrollAnimations.init();

    // Re-scan nach Template-Loading
    document.addEventListener('featuresTemplatesLoaded', () => {
      setTimeout(() => _SnapScrollAnimations.rescan(), 100);
    });

    // Menü-Assets laden
    loadMenuAssets();

    // Hard fallback für Loading
    setTimeout(hideLoading, 5000);
  });
})();