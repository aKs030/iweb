// ===== Shared Utilities Import =====
import {
  createTriggerOnceObserver,
  EVENTS,
  getElementById,
  TimerManager,
} from "../../content/webentwicklung/shared-utilities.js";

// Timer Manager für Hero-spezifische Timeouts
const heroTimers = new TimerManager();

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

    const heroEl =
      getElementById("hero") || document.querySelector("section#hero");
    if (!heroEl) {
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

    heroTimers.setTimeout(triggerLoad, 6000);
  }

  const ensureHeroData = async () =>
    heroData || (heroData = await import("./GrussText.js").catch((err) => { console.warn('Failed to load GrussText.js', err); return {}; }));

  // Hero Data Module für externe Verwendung (z.B. TypeWriter) bereitstellen
  window.__heroEnsureData = ensureHeroData;

  async function setRandomGreetingHTML(animated = false) {
    const delays = [0, 50, 120, 240, 480];
    let el = null;
    for (const d of delays) {
      if (d) await heroTimers.sleep(d);
      el = getElementById("greetingText");
      if (el) break;
    }
    if (!el) return;

    const mod = await ensureHeroData();
    const set = mod.getGreetingSet ? mod.getGreetingSet() : [];
    const next = mod.pickGreeting ? mod.pickGreeting(el.dataset.last, set) : "";
    if (!next) return;

    el.dataset.last = next;
    if (animated) {
      el.classList.add("fade");
      heroTimers.setTimeout(() => {
        el.textContent = next;
        el.classList.remove("fade");
      }, 360);
    } else {
      el.textContent = next;
    }
  }

  return { initLazyHeroModules, setRandomGreetingHTML, ensureHeroData };
})();

// ===== Animation Engine Bootstrap (entfernt) =====
function initHeroAnimationBootstrap() {
  // Animation-System wurde entfernt
}

// ===== Public API =====
export function initHeroFeatureBundle() {
  // Events für Hero
  document.addEventListener(EVENTS.HERO_LOADED, () => {
    const el = getElementById("greetingText");
    if (!el) return;
    if (!el.textContent.trim() || el.textContent.trim() === "Willkommen") {
      HeroManager.setRandomGreetingHTML();
      (window.announce || (() => {}))("Hero Bereich bereit.");
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
      console.warn('Error during typing initialization.', e);
    }

    // Force-Visible: CRT Buttons - Animation-System entfernt
  });

  // Verwende koordinierte Events statt separaten DOMContentLoaded Handler
  document.addEventListener(
    EVENTS.HERO_INIT_READY,
    () => {
      const el = getElementById("greetingText");
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
        console.warn('Error during typing initialization.', e);
      }
    },
    { once: true }
  );

  document.addEventListener(EVENTS.HERO_TYPING_END, (e) => {
    const text = e.detail?.text || "Text";
    (window.announce || (() => {}))(`Zitat vollständig: ${text}`);
  });

  // Lazy Hero Module + Animations
  HeroManager.initLazyHeroModules();
  heroTimers.setTimeout(initHeroAnimationBootstrap, 420);

  // Animation-System wurde entfernt
}
