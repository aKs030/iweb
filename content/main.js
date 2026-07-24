/**
 * Main Application Entry Point
 * @version 6.3.0
 */

import { createLogger } from "./core/logger.js";
import { a11y, createAnnouncer } from "./core/accessibility-manager.js";
import { SectionManager } from "./core/section-manager.js";
import { AppLoadManager, loadSignals } from "./core/load-manager.js";
import { signal, effect, computed } from "./core/signals.js";
import { TimerManager } from "./core/utils/index.js";
import { initViewTransitions } from "./core/view-transitions/index.js";
import { i18n } from "./core/i18n.js";
import { GlobalEventHandlers } from "./core/events.js";
import { resourceHints } from "./core/seo/index.js";
import { initThemeState } from "./core/state/theme-state.js";
import { initOverlayManager } from "./core/overlay-manager.js";
import { initEnhancements } from "#components/enhancements/index.js";

const log = createLogger("main");
const appTimers = new TimerManager("Main");

// ===== Configuration & Environment =====
const ENV = {
  isTest:
    new URLSearchParams(globalThis.location.search).has("test") ||
    navigator.userAgent.includes("HeadlessChrome") ||
    (globalThis.location.hostname === "localhost" && globalThis.navigator.webdriver),
};

// ===== Loading Configuration =====
const LOADING_CONFIG = {
  TIMEOUT_MS: 5000, // Maximale Wartezeit — danach wird Loader forciert ausgeblendet
};

// ===== Performance Tracking =====
const perfMarks = {
  start: performance.now(),
  domReady: 0,
  modulesReady: 0,
  windowLoaded: 0,
};

// ===== Accessibility Announcements =====
const announce = createAnnouncer();
globalThis.announce = announce;

// ===== Section Manager =====
const sectionManager = new SectionManager();

// ===== Initialize Managers =====
// Declared before onDOMReady so _initApp can reference it without temporal issues
const isHomeRoute = (globalThis.location.pathname || "/").replace(/\/+$/g, "") === "";
const loaderHidden = signal(false);
const modulesReady = signal(false);
const windowLoaded = signal(document.readyState === "complete");
const loadBlocked = computed(() => loadSignals.pending.value.length > 0);
const canHideLoader = computed(
  () => !loaderHidden.value && modulesReady.value && windowLoaded.value && !loadBlocked.value
);

let _appInitialized = false;

const _initApp = () => {
  if (_appInitialized) {
    log.debug("App already initialized, skipping duplicate init");
    return;
  }
  _appInitialized = true;

  sectionManager.init();

  try {
    a11y?.updateAnimations?.();
    a11y?.updateContrast?.();
  } catch (error) {
    log.warn("A11y update failed:", error);
  }

  initThemeState();
  initOverlayManager();

  // Keep full-page navigation native. Cross-document transitions can emit
  // uncaught "Transition was skipped" aborts during WebKit page teardown.
  initViewTransitions({
    captureInternalLinks: false,
    enableCrossDocument: false,
  });

  // Initialize Resource Hints & Speculative Prerendering
  resourceHints.init();

  // Initialize Enhancements (Section Dots, Reveal, Skill Radar, Voice, Easter Eggs)
  initEnhancements();
};

const initRouteFeatures = async () => {
  if (!isHomeRoute) return;

  const [{ initHeroFeatureBundle }, { ThreeEarthManager }] = await Promise.all([
    import("#pages/home/hero-manager.js"),
    import("#components/particles/index.js"),
  ]);

  const threeEarthLoader = new ThreeEarthManager(ENV);
  requestAnimationFrame(() => {
    threeEarthLoader.init();
  });
  initHeroFeatureBundle(sectionManager);
};

// ===== Application Bootstrap =====
document.addEventListener(
  "DOMContentLoaded",
  async () => {
    await i18n.init();
    perfMarks.domReady = performance.now();

    _initApp();

    const updateLoader = (progress, message, options) => {
      if (loaderHidden.value) return;
      AppLoadManager.updateLoader(progress, message, options);
    };

    effect(() => {
      const pending = loadSignals.pending.value;

      log.debug("Loader readiness changed", {
        modulesReady: modulesReady.value,
        windowLoaded: windowLoaded.value,
        isBlocked: loadBlocked.value,
        canHideLoader: canHideLoader.value,
        done: loadSignals.done.value,
        pending,
      });

      if (!canHideLoader.value) return;

      updateLoader(1, i18n.t("loader.ready_system"));
      loaderHidden.value = true;
      appTimers.setTimeout(() => AppLoadManager.hideLoader(), 100);
      announce(i18n.t("loader.app_loaded"), { dedupe: true });
    });

    globalThis.addEventListener(
      "load",
      () => {
        perfMarks.windowLoaded = performance.now();
        windowLoaded.value = true;
        updateLoader(0.7, i18n.t("loader.resources"));
      },
      { once: true }
    );

    updateLoader(0.3, i18n.t("loader.hero_init"));
    await initRouteFeatures();

    modulesReady.value = true;
    perfMarks.modulesReady = performance.now();
    updateLoader(0.6, i18n.t("loader.modules_loaded"));

    // Force hide after timeout
    appTimers.setTimeout(() => {
      if (!loaderHidden.value) {
        log.info("Forcing loading screen hide after timeout");
        updateLoader(1, i18n.t("loader.timeout"));
        loaderHidden.value = true;
        AppLoadManager.hideLoader();
      }
    }, LOADING_CONFIG.TIMEOUT_MS);

    // Initialize global event handlers
    GlobalEventHandlers.init(announce);

    log.info("Performance:", {
      domReady: Math.round(perfMarks.domReady - perfMarks.start),
      modulesReady: Math.round(perfMarks.modulesReady - perfMarks.start),
      windowLoaded: Math.round(perfMarks.windowLoaded - perfMarks.start),
    });
  },
  { once: true }
);

// ===== BFCache / Back Button Handling =====
globalThis.addEventListener("pageshow", event => {
  if (event.persisted) {
    log.info("Page restored from bfcache");
    globalThis.dispatchEvent(new CustomEvent("resize"));

    // Trigger visibility change to resume animations
    if (!document.hidden) {
      document.dispatchEvent(new CustomEvent("visibilitychange"));
    }
  }
});
