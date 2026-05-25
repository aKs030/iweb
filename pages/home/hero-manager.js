import { getElementById, observeOnce } from "#core/dom-utils.js";
import { createLogger } from "#core/logger.js";
import { TimerManager } from "#core/timer-manager.js";
import { i18n } from "#core/i18n.js";
import { ROBOT_EVENTS } from "#components/robot-companion/index.js";

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
  let auroraFrame = 0;
  let auroraMotionQuery = null;
  let auroraMotionChangeHandler = null;
  let auroraScrollHandler = null;
  let auroraResizeHandler = null;
  let cosmosPointerHandler = null;
  let cosmosPointerLeaveHandler = null;
  let cosmosPointerFrame = 0;
  let section3EntranceObserver = null;
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
        typeWriterModule = await import("#components/typewriter/index.js").catch(err => {
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

  let scrollObserver = null;

  function setupScrollObserver(heroEl) {
    if (scrollObserver) return;

    scrollObserver = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            heroEl.classList.add("is-visible");
          } else {
            heroEl.classList.remove("is-visible");
          }
        });
      },
      { threshold: 0.1 }
    );

    scrollObserver.observe(heroEl);
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
        adjustTitleFontSize();

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

    // Set up continuous scroll observation for animations
    setupScrollObserver(heroEl);

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

  function adjustTitleFontSize() {
    const title = document.querySelector(".hero__title");
    if (!title) return;

    const parent = title.parentElement;
    if (!parent) return;

    title.style.fontSize = "";

    const parentWidth = parent.clientWidth;
    const titleWidth = title.scrollWidth;

    if (titleWidth > parentWidth && parentWidth > 0) {
      const computedStyle = window.getComputedStyle(title);
      const currentSize = parseFloat(computedStyle.fontSize);
      const ratio = parentWidth / titleWidth;
      const newSize = Math.floor(currentSize * ratio * 0.97);
      title.style.fontSize = `${newSize}px`;
    }
  }

  function applyRandomHeroContent(dataModule) {
    if (!dataModule?.getHeroContent) return;

    const content = dataModule.getHeroContent(i18n.currentLang);
    [
      [".hero__title", content.title],
      [".hero__lede", content.lede],
    ].forEach(([selector, value]) => {
      const element = document.querySelector(selector);
      if (element && value) {
        element.textContent = value;
      }
    });

    [
      [".home-btn-group--hero .home-btn--primary", content.primaryBtn],
      [".home-btn-group--hero .home-btn--secondary", content.secondaryBtn],
    ].forEach(([selector, value]) => {
      const button = document.querySelector(selector);
      if (button && value) {
        const textSpan = button.querySelector(".home-btn-text");
        if (textSpan) {
          textSpan.textContent = value;
        } else {
          button.textContent = value;
        }
      }
    });

    adjustTitleFontSize();
  }

  async function setRandomGreetingHTML() {
    const el =
      getElementById("greetingText") ||
      (await waitForElement("#greetingText", GREETING_LOOKUP_DELAYS_MS));
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

  function updateAuroraPerspective() {
    auroraFrame = 0;

    const aurora = document.querySelector(".home-aurora");
    if (!aurora) return;

    // Handle vignette opacity update (common for both normal and reduced motion)
    const hero = document.querySelector(".hero");
    if (hero) {
      const heroHeight = hero.offsetHeight || window.innerHeight;
      const vignetteOpacity = Math.max(0, Math.min(1, 1 - window.scrollY / (heroHeight * 0.8)));
      hero.style.setProperty("--hero-vignette-opacity", vignetteOpacity.toFixed(2));
    }

    const reduceMotion = auroraMotionQuery?.matches;
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const progress = Math.min(1, Math.max(0, window.scrollY / maxScroll));

    if (reduceMotion) {
      aurora.style.setProperty("--aurora-depth", "0px");
      aurora.style.setProperty("--aurora-perspective-x", "50%");
      aurora.style.setProperty("--aurora-perspective-y", "50%");
      aurora.style.setProperty("--aurora-scale", "1");
      aurora.style.setProperty("--aurora-shift-x", "0px");
      aurora.style.setProperty("--aurora-shift-y", "0px");
      aurora.style.setProperty("--aurora-tilt-x", "0deg");
      aurora.style.setProperty("--aurora-tilt-y", "0deg");
      return;
    }

    // 3 full cycles across all sections for continuous 3D movement
    const wave = Math.sin(progress * Math.PI);
    const orbit = Math.sin(progress * Math.PI * 3);
    const counterOrbit = Math.cos(progress * Math.PI * 3);
    const slowOrbit = Math.sin(progress * Math.PI * 1.5);

    const tiltX = (counterOrbit * 8 + (progress - 0.5) * 14).toFixed(2);
    const tiltY = (orbit * 15).toFixed(2);
    const shiftX = (orbit * -80 + slowOrbit * 30).toFixed(1);
    const shiftY = ((progress - 0.5) * 80 + counterOrbit * 20).toFixed(1);
    const depth = (60 + wave * 140).toFixed(1);
    const scale = (1.0 + wave * 0.08).toFixed(3);
    const perspectiveX = (50 + orbit * 15 + slowOrbit * 5).toFixed(2);
    const perspectiveY = (50 + counterOrbit * 12).toFixed(2);

    aurora.style.setProperty("--aurora-depth", `${depth}px`);
    aurora.style.setProperty("--aurora-perspective-x", `${perspectiveX}%`);
    aurora.style.setProperty("--aurora-perspective-y", `${perspectiveY}%`);
    aurora.style.setProperty("--aurora-scale", scale);
    aurora.style.setProperty("--aurora-shift-x", `${shiftX}px`);
    aurora.style.setProperty("--aurora-shift-y", `${shiftY}px`);
    aurora.style.setProperty("--aurora-tilt-x", `${tiltX}deg`);
    aurora.style.setProperty("--aurora-tilt-y", `${tiltY}deg`);
  }

  function requestAuroraPerspectiveUpdate() {
    if (auroraFrame) return;
    auroraFrame = requestAnimationFrame(updateAuroraPerspective);
  }

  const starParallaxState = {
    x: 0,
    y: 0,
  };

  function updateStarParallax() {
    cosmosPointerFrame = 0;

    const stars = document.querySelector(".home-stars");
    if (!stars) return;

    if (auroraMotionQuery?.matches) {
      stars.style.setProperty("--home-stars-shift-x", "0px");
      stars.style.setProperty("--home-stars-shift-y", "0px");
      return;
    }

    const shiftX = (-starParallaxState.x * 16).toFixed(1);
    const shiftY = (-starParallaxState.y * 10).toFixed(1);
    stars.style.setProperty("--home-stars-shift-x", `${shiftX}px`);
    stars.style.setProperty("--home-stars-shift-y", `${shiftY}px`);
  }

  function requestStarParallaxUpdate() {
    if (cosmosPointerFrame) return;
    cosmosPointerFrame = requestAnimationFrame(updateStarParallax);
  }

  function resetStarParallax() {
    starParallaxState.x = 0;
    starParallaxState.y = 0;
    requestStarParallaxUpdate();
  }

  function setupSection3Entrance() {
    const section3 = getElementById("section3") || document.querySelector("section#section3");
    if (!section3) return;

    if (section3EntranceObserver) {
      section3EntranceObserver.disconnect();
      section3EntranceObserver = null;
    }

    if (!("IntersectionObserver" in window)) {
      section3.classList.add("is-visible");
      return;
    }

    section3EntranceObserver = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          section3.classList.add("is-visible");
          section3EntranceObserver?.unobserve(section3);
        });
      },
      { threshold: 0.22, rootMargin: "0px 0px -12% 0px" }
    );

    section3EntranceObserver.observe(section3);
  }

  function toggleCosmosPointerListener() {
    if (auroraMotionQuery?.matches) {
      window.removeEventListener("pointermove", cosmosPointerHandler);
    } else {
      window.removeEventListener("pointermove", cosmosPointerHandler);
      window.addEventListener("pointermove", cosmosPointerHandler, { passive: true });
    }
  }

  function setupHomeAuroraPerspective() {
    if (auroraScrollHandler || typeof window === "undefined") return;

    auroraMotionQuery = window.matchMedia?.("(prefers-reduced-motion: reduce)") ?? null;
    auroraScrollHandler = requestAuroraPerspectiveUpdate;
    auroraResizeHandler = () => {
      requestAuroraPerspectiveUpdate();
      adjustTitleFontSize();
    };
    auroraMotionChangeHandler = () => {
      requestAuroraPerspectiveUpdate();
      resetStarParallax();
      toggleCosmosPointerListener();
    };
    cosmosPointerHandler = event => {
      starParallaxState.x = Math.max(
        -1,
        Math.min(1, (event.clientX / window.innerWidth - 0.5) * 2)
      );
      starParallaxState.y = Math.max(
        -1,
        Math.min(1, (event.clientY / window.innerHeight - 0.5) * 2)
      );
      requestStarParallaxUpdate();
    };
    cosmosPointerLeaveHandler = resetStarParallax;

    window.addEventListener("scroll", auroraScrollHandler, { passive: true });
    window.addEventListener("resize", auroraResizeHandler, { passive: true });
    window.addEventListener("blur", cosmosPointerLeaveHandler, { passive: true });
    document.addEventListener("mouseleave", cosmosPointerLeaveHandler, { passive: true });
    auroraMotionQuery?.addEventListener?.("change", auroraMotionChangeHandler);

    toggleCosmosPointerListener();
    updateAuroraPerspective();
    updateStarParallax();
    adjustTitleFontSize();
  }

  function cleanup() {
    heroTimers.clearAll();
    isInitialized = false;
    loaded = false;
    triggerLoad = null;
    heroLookupAttempts = 0;

    if (scrollObserver) {
      scrollObserver.disconnect();
      scrollObserver = null;
    }
    if (auroraFrame) {
      cancelAnimationFrame(auroraFrame);
      auroraFrame = 0;
    }
    if (cosmosPointerFrame) {
      cancelAnimationFrame(cosmosPointerFrame);
      cosmosPointerFrame = 0;
    }
    if (auroraScrollHandler) {
      window.removeEventListener("scroll", auroraScrollHandler);
      auroraScrollHandler = null;
    }
    if (auroraResizeHandler) {
      window.removeEventListener("resize", auroraResizeHandler);
      auroraResizeHandler = null;
    }
    if (auroraMotionChangeHandler) {
      auroraMotionQuery?.removeEventListener?.("change", auroraMotionChangeHandler);
      auroraMotionChangeHandler = null;
      auroraMotionQuery = null;
    }
    if (cosmosPointerHandler) {
      window.removeEventListener("pointermove", cosmosPointerHandler);
      cosmosPointerHandler = null;
    }
    if (cosmosPointerLeaveHandler) {
      window.removeEventListener("blur", cosmosPointerLeaveHandler);
      document.removeEventListener("mouseleave", cosmosPointerLeaveHandler);
      cosmosPointerLeaveHandler = null;
    }
    if (section3EntranceObserver) {
      section3EntranceObserver.disconnect();
      section3EntranceObserver = null;
    }

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
    setupHomeAuroraPerspective,
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
    setupSection3Entrance,
  };
})();

// ===== Public API =====
export const initHeroFeatureBundle = sectionManager => {
  HeroManager.cleanup();

  HeroManager.setupLanguageListener();
  HeroManager.setupTypingEndListener();
  HeroManager.setupHomeAuroraPerspective();
  HeroManager.setupSection3Entrance();

  HeroManager.initLazyHeroModules();

  const handleHeroClick = async event => {
    const eventTarget = event.target instanceof Element ? event.target : null;
    const link = eventTarget?.closest('.home-btn-group--hero a[href^="#"]');
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
