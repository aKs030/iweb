import { getElementById, observeOnce } from "#core/dom-utils.js";
import { createLogger } from "#core/logger.js";
import { TimerManager } from "#core/timer-manager.js";
import { i18n } from "#core/i18n.js";
import { ROBOT_EVENTS } from "#components/robot-companion/constants/events.js";

let typeWriterModule = null;

const log = createLogger("HeroManager");

const heroTimers = new TimerManager("HeroTimers");

// ===== Hero Management Module =====
const HERO_LAZY_FALLBACK_MS = 6000;
const HERO_LOOKUP_MAX = 3;
const HERO_LOOKUP_DELAY_MS = 900;
const HERO_MARKUP_DELAYS_MS = Object.freeze([0, 50, 120, 240, 480, 900, 1500, 2400]);
const GREETING_LOOKUP_DELAYS_MS = Object.freeze([0, 50, 120, 240, 480]);

const HeroManager = (() => {
  let heroData = null;
  let isInitialized = false;
  let clickHandler = null;
  let observerCleanup = null;
  let loaded = false;
  let triggerLoad = null;
  let heroLookupAttempts = 0;
  let languageChangeHandler = null;
  let typingEndHandler = null;

  async function loadTyped(heroDataModule) {
    try {
      if (!typeWriterModule) {
        typeWriterModule = await import("#components/typewriter/TypeWriter.js").catch(err => {
          log.warn("Failed to import TypeWriter module", err);
          return null;
        });
      }

      if (!typeWriterModule?.initHeroSubtitle) return false;

      const tw = await typeWriterModule.initHeroSubtitle({ heroDataModule });
      if (tw) {
        return tw;
      }
    } catch (err) {
      log.warn("Failed to load TypeWriter modules", err);
    }
    return false;
  }

  function initLazyHeroModules() {
    if (isInitialized) return;

    if (!triggerLoad) {
      triggerLoad = async () => {
        if (loaded) return;
        loaded = true;

        const dataModule = await ensureHeroData().catch(() => ({}));
        await waitForElement(".hero__poster", HERO_MARKUP_DELAYS_MS);
        applyRandomHeroContent(dataModule);
        await setRandomGreetingHTML();
        await loadTyped(dataModule);

        isInitialized = true;
      };
    }

    const heroEl = getElementById("hero") || document.querySelector("section#hero");
    if (!heroEl) {
      if (heroLookupAttempts < HERO_LOOKUP_MAX) {
        heroLookupAttempts += 1;
        heroTimers.setTimeout(initLazyHeroModules, HERO_LOOKUP_DELAY_MS * heroLookupAttempts);
      } else {
        heroTimers.setTimeout(triggerLoad, HERO_LAZY_FALLBACK_MS);
      }
      return;
    }

    heroLookupAttempts = 0;

    const rect = heroEl.getBoundingClientRect();
    if (rect.top < innerHeight && rect.bottom > 0) {
      // Hero is visible, trigger immediately
      triggerLoad();
      return;
    }

    observerCleanup = observeOnce(heroEl, triggerLoad);
    heroTimers.setTimeout(triggerLoad, HERO_LAZY_FALLBACK_MS);
  }

  const ensureHeroData = async () =>
    heroData ||
    (heroData = await import("./GrussText.js").catch(err => {
      log.warn("Failed to load GrussText.js", err);
      return {};
    }));

  const waitWithHeroTimer = delay => new Promise(resolve => heroTimers.setTimeout(resolve, delay));

  async function waitForElement(selector, delays) {
    for (const delay of delays) {
      if (delay) await waitWithHeroTimer(delay);
      const element = document.querySelector(selector);
      if (element) return element;
    }
    return null;
  }

  function applyRandomHeroContent(dataModule) {
    if (!dataModule?.getHeroContent) return;

    const content = dataModule.getHeroContent(i18n.currentLang);
    [
      [".hero__title", content.title],
      [".hero__lede", content.lede],
      [".hero__button--primary", content.primaryBtn],
      [".hero__button--secondary", content.secondaryBtn],
    ].forEach(([selector, value]) => {
      const element = document.querySelector(selector);
      if (element && value) element.textContent = value;
    });

    const metaEls = document.querySelectorAll(".hero__meta li");
    if (metaEls.length > 0 && content.meta) {
      metaEls.forEach((el, i) => {
        if (content.meta[i]) el.textContent = content.meta[i];
      });
    }
  }

  async function setRandomGreetingHTML() {
    const el = getElementById("greetingText") || (await waitForElement("#greetingText", GREETING_LOOKUP_DELAYS_MS));
    if (!el) return;

    try {
      const mod = await ensureHeroData();
      const set = mod.getGreetingSet?.(new Date(), i18n.currentLang) ?? [];
      const next = mod.pickGreeting?.(el.dataset.last, set) ?? "";
      if (!next) return;

      el.dataset.last = next;
      el.textContent = next;
    } catch (e) {
      log.warn("Error setting greeting text", e);
    }
  }

  function cleanup() {
    heroTimers.clearAll();
    isInitialized = false;
    loaded = false;
    triggerLoad = null;
    heroLookupAttempts = 0;
    try {
      typeWriterModule?.stopHeroSubtitle?.();
    } catch (err) {
      log.warn("HeroManager: stopHeroSubtitle failed", err);
    }
    if (clickHandler) {
      document.removeEventListener("click", clickHandler);
      clickHandler = null;
    }
    if (languageChangeHandler) {
      i18n.removeEventListener("language-changed", languageChangeHandler);
      languageChangeHandler = null;
    }
    if (typingEndHandler) {
      document.removeEventListener(ROBOT_EVENTS.HERO_TYPING_END, typingEndHandler);
      typingEndHandler = null;
    }
    if (observerCleanup) {
      try {
        observerCleanup();
      } catch (err) {
        log.warn("HeroManager: observer disconnect failed", err);
      }
      observerCleanup = null;
    }
  }

  function setClickHandler(handler) {
    if (clickHandler) {
      document.removeEventListener("click", clickHandler);
    }
    clickHandler = handler;
    document.addEventListener("click", handler);
  }

  return {
    initLazyHeroModules,
    setRandomGreetingHTML,
    ensureHeroData,
    cleanup,
    setClickHandler,
    setupLanguageListener: () => {
      if (languageChangeHandler) {
        i18n.removeEventListener("language-changed", languageChangeHandler);
      }
      languageChangeHandler = async () => {
        const dataModule = await ensureHeroData();
        applyRandomHeroContent(dataModule);
        await setRandomGreetingHTML();
      };
      i18n.addEventListener("language-changed", languageChangeHandler);
    },
    setupTypingEndListener: () => {
      if (typingEndHandler) {
        document.removeEventListener(ROBOT_EVENTS.HERO_TYPING_END, typingEndHandler);
      }
      typingEndHandler = e => {
        const detail = /** @type {CustomEvent} */ (e).detail;
        window.announce?.(`Zitat vollständig: ${detail?.text ?? "Text"}`);
      };
      document.addEventListener(ROBOT_EVENTS.HERO_TYPING_END, typingEndHandler);
    },
  };
})();

// ===== Public API =====
export const initHeroFeatureBundle = sectionManager => {
  HeroManager.cleanup();

  HeroManager.setupLanguageListener();
  HeroManager.setupTypingEndListener();

  HeroManager.initLazyHeroModules();

  const handleHeroClick = async event => {
    const eventTarget = event.target instanceof Element ? event.target : null;
    const link = eventTarget?.closest('.hero__buttons a[href^="#"]');
    if (!link) return;

    const href = link.getAttribute("href") || "";
    if (!href.startsWith("#")) return;

    event.preventDefault();
    const targetId = href.slice(1);
    const target = getElementById(targetId) || document.getElementById(targetId);
    if (!target) return;

    function doScroll() {
      try {
        target.scrollIntoView({ behavior: "smooth" });
      } catch (err) {
        log.warn("HeroManager: scrollIntoView failed, using fallback", err);
        const top = target.getBoundingClientRect().top + window.scrollY;
        window.scrollTo({ top, behavior: "smooth" });
      }
    }

    if (sectionManager?.loadSection) {
      sectionManager.loadSection(target).finally(() => requestAnimationFrame(doScroll));
    } else {
      requestAnimationFrame(doScroll);
    }
  };

  HeroManager.setClickHandler(handleHeroClick);
};
