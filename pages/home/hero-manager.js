// ===== Shared Utilities Import =====
import {
  createTriggerOnceObserver,
  EVENTS,
  getElementById,
  TimerManager
} from '../../content/webentwicklung/shared-utilities.js';
import { createLogger } from '../../content/webentwicklung/shared-utilities.js';

// Logger für HeroManager
const logger = createLogger('HeroManager');

// Timer Manager für Hero-spezifische Timeouts
const heroTimers = new TimerManager();

// ===== Hero Management Module =====
const HeroManager = (() => {
  let heroData = null;
  let isInitialized = false;

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
    if (isInitialized) return;
    isInitialized = true;

    let loaded = false;
    const triggerLoad = async () => {
      if (loaded) return;
      loaded = true;
      // Preload critical hero data parallel to typewriter check
      ensureHeroData().catch(() => {}); 
      
      await loadTyped();
      setRandomGreetingHTML();
    };

    const heroEl = getElementById('hero') || document.querySelector('section#hero');
    if (!heroEl) {
      // Retry or fallback if hero element missing momentarily
      heroTimers.setTimeout(triggerLoad, 2500);
      return;
    }

    const rect = heroEl.getBoundingClientRect();
    if (rect.top < innerHeight && rect.bottom > 0) {
      triggerLoad();
      return;
    }

    const obs = createTriggerOnceObserver(triggerLoad);
    obs.observe(heroEl);

    // Fallback load just in case observer fails or is delayed too long
    heroTimers.setTimeout(triggerLoad, 6000);
  }

  const ensureHeroData = async () =>
    heroData ||
    (heroData = await import('./GrussText.js').catch((err) => {
      logger.warn('Failed to load GrussText.js', err);
      return {};
    }));

  // Hero Data Module für externe Verwendung (z.B. TypeWriter) bereitstellen
  window.__heroEnsureData = ensureHeroData;

  async function setRandomGreetingHTML(animated = false) {
    const delays = [0, 50, 120, 240, 480];
    let el = null;
    // Retry finding element with exponential backoff if not immediately present
    for (const d of delays) {
      if (d) await heroTimers.sleep(d);
      el = getElementById('greetingText');
      if (el) break;
    }
    if (!el) return;

    try {
      const mod = await ensureHeroData();
      const set = mod.getGreetingSet ? mod.getGreetingSet() : [];
      const next = mod.pickGreeting ? mod.pickGreeting(el.dataset.last, set) : '';
      if (!next) return;

      el.dataset.last = next;
      if (animated) {
        el.classList.add('fade');
        heroTimers.setTimeout(() => {
          el.textContent = next;
          el.classList.remove('fade');
        }, 360);
      } else {
        el.textContent = next;
      }
    } catch (e) {
      logger.warn('Error setting greeting text', e);
    }
  }

  function cleanup() {
    heroTimers.clearAll();
    isInitialized = false;
  }

  return { initLazyHeroModules, setRandomGreetingHTML, ensureHeroData, cleanup };
})();

// ===== Public API =====
export function initHeroFeatureBundle() {
  // Clear any existing timers first to prevent duplicate logic on re-init
  HeroManager.cleanup();

  // Events für Hero
  const onHeroLoaded = () => {
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
        Promise.resolve(window.__initTyping?.()).catch(() => {
          window.__typingStarted = false;
        });
      }
    } catch (e) {
      logger.warn('Error during typing initialization.', e);
    }
  };

  // Event Listener sicher hinzufügen (Remove if existing, though anonymous funcs make this hard, rely on singleton/flags)
  document.removeEventListener(EVENTS.HERO_LOADED, onHeroLoaded);
  document.addEventListener(EVENTS.HERO_LOADED, onHeroLoaded);

  // Verwende koordinierte Events statt separaten DOMContentLoaded Handler
  document.addEventListener(
    EVENTS.HERO_INIT_READY,
    () => {
      const el = getElementById('greetingText');
      if (!el) return;
      if (!el.textContent.trim()) {
        HeroManager.setRandomGreetingHTML();
      }
      // Fallback: Typing starten, falls hero:loaded noch nicht gefeuert hat
      try {
        if (!window.__typingStarted) {
          window.__typingStarted = true;
          Promise.resolve(window.__initTyping?.()).catch(() => {
            window.__typingStarted = false;
          });
        }
      } catch (e) {
        logger.warn('Error during typing initialization.', e);
      }
    },
    { once: true }
  );

  document.addEventListener(EVENTS.HERO_TYPING_END, (e) => {
    const text = e.detail?.text || 'Text';
    (window.announce || (() => {}))(`Zitat vollständig: ${text}`);
  });

  // Lazy Hero Module + Animations
  HeroManager.initLazyHeroModules();
}