import { throttle, getElementById } from '../../content/webentwicklung/utils/common-utils.js';
import { initParticles as _initParticles } from '../../content/webentwicklung/particles/particle-system.js';
import { EVENTS } from '../../content/webentwicklung/utils/events.js';
import { initHeroAnimations } from './hero-animations.js';

// ===== Hero Management Module =====
const HeroManager = (() => {
  let TypeWriter = null, makeLineMeasurer = null, quotes = [], heroData = null;

  async function loadTyped() {
    const modules = [
      ['./TypeWriter.js', m => { TypeWriter = m.default; }],
      ['./lineMeasurer.js', m => { makeLineMeasurer = m.makeLineMeasurer; }],
      ['./quotes-de.js', m => { quotes = m.default || m.quotes; }],
    ];
    for (const [path, handler] of modules) {
      try {
        const module = await import(path);
        handler(module);
      } catch (_error) {
        // Silent fail
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

  const ensureHeroData = async () => heroData || (heroData = await import('./hero-data.js').catch(() => ({})));

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

  // Typing-Initialisierung für externe Verwendung
  window.__initTyping = async () => {
    if (!TypeWriter || !makeLineMeasurer || !quotes.length) {
      await loadTyped();
    }
    const module = await import('./TypeWriter.js');
    return (typeof module.initHeroSubtitle === 'function')
      ? module.initHeroSubtitle({
        ensureHeroDataModule: ensureHeroData,
        makeLineMeasurer,
        quotes,
        TypeWriterClass: TypeWriter
      })
      : false;
  };

  return { initLazyHeroModules, setRandomGreetingHTML, ensureHeroData };
})();

// ===== Particles Module =====
const ParticlesManager = (() => {
  const initParticles = () => {
    const canvas = getElementById('particleCanvas');
    if (!canvas) {
      return () => {};
    }
    return _initParticles({ getElement: getElementById, throttle });
  };
  return { initParticles };
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
      const active = document.getElementById(id);
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

      // Wenn zurck zum Hero gescrollt wurde, CRT-Buttons wieder sichtbar machen
      if (id === 'hero') {
        try {
          active.querySelectorAll('.hero-buttons [data-animation="crt"]').forEach(btn => {
            btn.classList.add('animate-element', 'is-visible');
          });
        } catch { /* noop */ }
      }
    });
  } catch (_error) {
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

  // Lazy Hero Module + Particles + Animations
  HeroManager.initLazyHeroModules();
  setTimeout(() => {
    try {
      const stopParticles = ParticlesManager.initParticles();
      window.__stopParticles = stopParticles;
    } catch (_error) {
      // Silent fail
    }
  }, 100);
  setTimeout(initHeroAnimationBootstrap, 420);
  
  // Initialisiere Hero-spezifische Animationen
  initHeroAnimations();
}

