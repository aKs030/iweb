import { getElementById } from '../../content/webentwicklung/utils/common-utils.js';
import { EVENTS } from '../../content/webentwicklung/utils/events.js';
import { createLogger } from '../../content/webentwicklung/utils/logger.js';
import { triggerAnimationScan } from '../../content/webentwicklung/utils/animation-utils.js';

const log = createLogger('hero-manager');

// ===== Hero-spezifische Animation Engine Erweiterungen =====

/**
 * Hero-spezifische Animation-Aliases
 * Diese Aliases waren ursprünglich in der enhanced-animation-engine.js
 */
export const HERO_ANIMATION_ALIASES = new Map([
  // Hero-spezifische Grußtext-Animation
  ['greeting', 'fadeInUp'],
  // Weitere Hero-spezifische Animationen können hier hinzugefügt werden
]);

/**
 * Hero-spezifische Animation-Konfiguration
 */
export const HERO_ANIMATION_CONFIG = {
  // Optimierte Performance-Einstellungen für Hero-Bereich
  threshold: 0.1,
  rootMargin: '50px',
  repeatOnScroll: true,
  
  // Hero-spezifische Animation-Durationen
  durations: {
    greeting: 0.8,      // Längere Dauer für Grußtext
    heroButtons: 0.6,   // Standard für Hero-Buttons
    heroSubtitle: 0.7   // Subtitle-Animationen
  }
};

/**
 * Erweitert die globale Animation Engine um Hero-spezifische Aliases
 * @param {Object} animationEngine - Die Enhanced Animation Engine Instanz
 */
export function extendAnimationEngineForHero(animationEngine) {
  if (!animationEngine || typeof animationEngine.parseDataAttribute !== 'function') {
    log.warn('Animation Engine nicht verfügbar oder inkompatibel');
    return;
  }

  // Backup der ursprünglichen parseDataAttribute Methode
  const originalParseDataAttribute = animationEngine.parseDataAttribute.bind(animationEngine);
  
  // Erweiterte parseDataAttribute Methode mit Hero-Aliases
  animationEngine.parseDataAttribute = function(element, attribute) {
    const result = originalParseDataAttribute(element, attribute);
    
    if (!result) return null;
    
    // Hero-spezifische Alias-Behandlung
    const heroAlias = HERO_ANIMATION_ALIASES.get(result.type?.toLowerCase());
    if (heroAlias) {
      result.type = heroAlias;
    }
    
    return result;
  };
}





/**
 * Initialisiert Hero-spezifische Animationen
 * Sollte nach dem Laden der main Animation Engine aufgerufen werden
 */
function initHeroAnimations() {
  // Warten bis die globale Animation Engine verfügbar ist
  const waitForEngine = () => {
    if (window.enhancedAnimationEngine) {
      extendAnimationEngineForHero(window.enhancedAnimationEngine);
      
      // Hero-spezifische Konfiguration anwenden
      window.enhancedAnimationEngine.setRepeatOnScroll?.(HERO_ANIMATION_CONFIG.repeatOnScroll);
      
      // Initial scan für Hero-Elemente
      triggerAnimationScan('hero-init');
      
      log.debug('Hero-spezifische Animationen initialisiert');
    } else {
      // Retry nach kurzer Verzögerung
      setTimeout(waitForEngine, 100);
    }
  };
  
  waitForEngine();
}

// ===== Hero Management Module =====
const HeroManager = (() => {
  let heroData = null;

  async function loadTyped() {
    // Nutze globale TypeWriter Registry
    if (window.TypeWriterRegistry) {
      try {
        await window.TypeWriterRegistry.loadModules();
        return window.TypeWriterRegistry.isReady();
      } catch {
        return false;
      }
    }
    return false;
  }

  function initLazyHeroModules() {
    let loaded = false;
    const triggerLoad = async () => {
      if (loaded) return;
      loaded = true;
      await loadTyped();
      setRandomGreetingHTML();
    };

    const heroEl = getElementById('hero') || document.querySelector('section#hero');
    if (!heroEl) {
      setTimeout(triggerLoad, 2500);
      return;
    }

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

    setTimeout(triggerLoad, 6000);
  }

  const ensureHeroData = async () => heroData || (heroData = await import('./GrussText.js').catch(() => ({})));

  // Hero Data Module für externe Verwendung (z.B. TypeWriter) bereitstellen
  window.__heroEnsureData = ensureHeroData;

  async function setRandomGreetingHTML(animated = false) {
    const delays = [0, 50, 120, 240, 480];
    let el = null;
    for (const d of delays) {
      if (d) await new Promise(r => setTimeout(r, d));
      el = getElementById('greetingText');
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

  return { initLazyHeroModules, setRandomGreetingHTML, ensureHeroData };
})();

// ===== Animation Engine Bootstrap (nur für Hero-bezogene Trigger) =====
function initHeroAnimationBootstrap() {
  try {
    const hero = getElementById('hero');
    if (!hero) return;
    
    // Prüfen ob echte Animation Engine bereits existiert
    if (!window.enhancedAnimationEngine) {
      // Fallback: Nur setzen wenn noch nicht vorhanden
      // Diese wird später von der echten Engine ersetzt, ohne sie zu überschreiben
      const fallbackEngine = {
        scan() { return true; },
        setRepeatOnScroll() { return true; },
        resetElementsIn(container) {
          if (!container) return;
          const elements = container.querySelectorAll('[data-animation]');
          elements.forEach(el => el.classList.remove('animate-in', 'is-visible'));
        },
        animateElementsIn(container) {
          if (!container) return;
          const elements = container.querySelectorAll('[data-animation]');
          elements.forEach((el, index) => {
            setTimeout(() => el.classList.add('animate-in', 'is-visible'), index * 100);
          });
        }
      };
      window.enhancedAnimationEngine = fallbackEngine;
    }
    
    // Animation Engine konfigurieren (sowohl Fallback als auch echte Engine)
    window.enhancedAnimationEngine.setRepeatOnScroll?.(true);
    const scan = () => window.enhancedAnimationEngine.scan?.();
    scan();
    setTimeout(scan, 1000);
    hero.querySelectorAll('.hero-buttons [data-animation="crt"].animate-element:not(.is-visible)')
      ?.forEach(b => b.classList.add('is-visible'));
    window.addEventListener('snapSectionChange', (e) => {
      const id = e.detail?.id;
      if (!id) return;
      const active = getElementById(id);
      if (!active) return;
      try {
        const allSections = Array.from(document.querySelectorAll('main .section, .section'));
        for (const s of allSections) {
          if (s !== active) {
            window.enhancedAnimationEngine?.resetElementsIn?.(s);
          }
        }
      } catch { /* noop */ }
      window.enhancedAnimationEngine?.animateElementsIn?.(active, { force: true });

      // Wenn zurück zum Hero gescrollt wurde, CRT-Buttons wieder sichtbar machen
      if (id === 'hero') {
        try {
          active.querySelectorAll('.hero-buttons [data-animation="crt"]').forEach(btn => {
            btn.classList.add('animate-element', 'is-visible');
          });
        } catch { /* noop */ }
      }
    });
  } catch {
    // Silent fail
  }
}

// ===== Public API =====
export function initHeroFeatureBundle() {
  // Events für Hero
  document.addEventListener(EVENTS.HERO_LOADED, () => {
    const el = getElementById('greetingText');
    if (!el) return;
    if (!el.textContent.trim() || el.textContent.trim() === 'Willkommen') {
      HeroManager.setRandomGreetingHTML();
      (window.announce || (() => {}))('Hero Bereich bereit.');
    }
    // Einmalige Typing-Initialisierung starten
    try {
      if (!window.__typingStarted) {
        window.__typingStarted = true;
        Promise.resolve(window.__initTyping?.()).catch(() => { window.__typingStarted = false; });
      }
    } catch { /* noop */ }

    // Force-Visible: CRT Buttons sofort sichtbar machen, falls Animation-Scan später kommt
    try {
      document.querySelectorAll('.hero-buttons [data-animation="crt"]').forEach(btn => {
        btn.classList.add('animate-element', 'is-visible');
      });
    } catch { /* noop */ }
  });

  // Verwende koordinierte Events statt separaten DOMContentLoaded Handler
  document.addEventListener(EVENTS.HERO_INIT_READY, () => {
    const el = getElementById('greetingText');
    if (!el) return;
    if (!el.textContent.trim()) {
      HeroManager.setRandomGreetingHTML();
    }
    // Fallback: Typing starten, falls hero:loaded noch nicht gefeuert hat
    try {
      if (!window.__typingStarted) {
        window.__typingStarted = true;
        Promise.resolve(window.__initTyping?.()).catch(() => { window.__typingStarted = false; });
      }
    } catch { /* noop */ }
  }, { once: true });

  document.addEventListener(EVENTS.HERO_TYPING_END, (e) => {
    const text = e.detail?.text || 'Text';
    (window.announce || (() => {}))(`Zitat vollständig: ${text}`);
  });

  // Lazy Hero Module + Animations
  HeroManager.initLazyHeroModules();
  setTimeout(initHeroAnimationBootstrap, 420);
  
  // Initialisiere Hero-spezifische Animationen
  initHeroAnimations();
}

