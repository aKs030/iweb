/**
 * Main Application Entry Point - Optimized
 * * OPTIMIZATIONS v4.1 (Performance):
 * - Fine-tuned ThreeEarthLoader init
 * - Ensure proper cleanup references
 * * @version 4.1.0
 * @last-modified 2025-11-29
 */

import { initHeroFeatureBundle } from "../pages/home/hero-manager.js";
import {
  createLazyLoadObserver,
  createLogger,
  EVENTS,
  fetchWithTimeout,
  fire,
  getElementById,
  schedulePersistentStorageRequest,
  AppLoadManager,
  SectionTracker,
} from "./utils/shared-utilities.js";
// initHeroSubtitle is imported where needed (hero manager); legacy global exposure removed
import { a11y } from "./utils/accessibility-manager.js";
// Accessibility manager initializes itself and exposes a11y as needed (avoid duplicate global writes here)

import "./components/menu/menu.js";

const log = createLogger("main");

// Debug / Dev hooks (exported for test & debug tooling)
let __threeEarthCleanup = null;

// ===== Configuration & Environment =====
const ENV = {
  isTest:
    new URLSearchParams(globalThis.location.search).has("test") ||
    navigator.userAgent.includes("HeadlessChrome") ||
    (globalThis.location.hostname === "localhost" &&
      globalThis.navigator.webdriver),
  debug: new URLSearchParams(globalThis.location.search).has("debug"),
};

// ===== Performance Tracking =====
const perfMarks = {
  start: performance.now(),
  domReady: 0,
  modulesReady: 0,
  windowLoaded: 0,
};

// ===== Accessibility Announcements =====
const announce = (() => {
  const cache = new Map();

  return (message, { assertive = false, dedupe = false } = {}) => {
    if (!message) return;

    if (dedupe && cache.has(message)) return;
    if (dedupe) {
      cache.set(message, true);
      setTimeout(() => cache.delete(message), 3000);
    }

    try {
      const id = assertive ? "live-region-assertive" : "live-region-status";
      const region = getElementById(id);
      if (!region) return;

      region.textContent = "";
      requestAnimationFrame(() => {
        region.textContent = message;
      });
    } catch (error) {
      log.debug("Announcement failed:", error);
    }
  };
})();

// Export for other modules if needed, but avoid window global if possible.
// Legacy support for inline scripts or external dependencies:
globalThis.announce = announce;

// ===== Section Tracker =====
const sectionTracker = new SectionTracker();
sectionTracker.init();
// Kept for debugging/external access if strictly needed, but marked for review
if (ENV.debug) globalThis.sectionTracker = sectionTracker;

// ===== Section Loader =====
const SectionLoader = (() => {
  // Check if already initialized to prevent double execution
  if (globalThis.SectionLoader) return globalThis.SectionLoader;

  const SELECTOR = "section[data-section-src]";
  const loadedSections = new WeakSet();
  const retryAttempts = new WeakMap();
  const MAX_RETRIES = 2;

  function dispatchEvent(type, section, detail = {}) {
    try {
      document.dispatchEvent(
        new CustomEvent(type, {
          detail: { id: section?.id, section, ...detail },
        })
      );
    } catch (error) {
      log.debug(`Event dispatch failed: ${type}`, error);
    }
  }

  function getSectionName(section) {
    const labelId = section.getAttribute("aria-labelledby");
    if (labelId) {
      const label = getElementById(labelId);
      const text = label?.textContent?.trim();
      if (text) return text;
    }
    return section.id || "Abschnitt";
  }

  function getFetchCandidates(url) {
    if (url?.endsWith(".html")) {
      return [url.replace(/\.html$/, ""), url];
    } else if (url?.startsWith("/pages/")) {
      return [(url || "") + ".html", url];
    } else {
      return [url, (url || "") + ".html"];
    }
  }

  async function fetchSectionContent(url) {
    let response;
    const fetchCandidates = getFetchCandidates(url);
    for (const candidate of fetchCandidates) {
      try {
        response = await fetchWithTimeout(candidate);
        if (response && response.ok) break;
      } catch {
        response = null;
      }
    }
    if (!response || !response.ok) {
      throw new Error(
        `HTTP ${response ? response.status : "NO_RESPONSE"}: ${
          response ? response.statusText : "no response"
        }`
      );
    }
    return await response.text();
  }

  async function loadSection(section) {
    if (loadedSections.has(section)) return;

    const url = section.dataset.sectionSrc;
    if (!url) {
      section.removeAttribute("aria-busy");
      return;
    }

    loadedSections.add(section);
    const sectionName = getSectionName(section);
    const attempts = retryAttempts.get(section) || 0;

    section.setAttribute("aria-busy", "true");
    section.dataset.state = "loading";

    announce(`Lade ${sectionName}…`, { dedupe: true });
    dispatchEvent("section:will-load", section, { url });

    try {
      const html = await fetchSectionContent(url);
      section.insertAdjacentHTML("beforeend", html);

      const template = section.querySelector("template");
      if (template) {
        section.appendChild(template.content.cloneNode(true));
      }

      section
        .querySelectorAll(".section-skeleton")
        .forEach((el) => el.remove());

      section.dataset.state = "loaded";
      section.removeAttribute("aria-busy");

      announce(`${sectionName} geladen`, { dedupe: true });
      dispatchEvent("section:loaded", section, { state: "loaded" });

      if (section.id === "hero") {
        fire(EVENTS.HERO_LOADED);
      }
    } catch (error) {
      log.warn(`Section load failed: ${sectionName}`, error);

      const isTransient = /5\d\d/.test(String(error)) || !navigator.onLine;
      const shouldRetry = isTransient && attempts < MAX_RETRIES;

      if (shouldRetry) {
        retryAttempts.set(section, attempts + 1);
        loadedSections.delete(section);

        const delay = 300 * Math.pow(2, attempts);
        await new Promise((resolve) => setTimeout(resolve, delay));

        return loadSection(section);
      }

      section.dataset.state = "error";
      section.removeAttribute("aria-busy");

      announce(`Fehler beim Laden von ${sectionName}`, { assertive: true });
      dispatchEvent("section:error", section, { state: "error" });

      // Inline injectRetryUI: inject a small retry UI directly
      if (!section.querySelector(".section-retry")) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "section-retry";
        button.textContent = "Erneut laden";
        button.addEventListener("click", () => retrySection(section), {
          once: true,
        });

        const wrapper = document.createElement("div");
        wrapper.className = "section-error-box";
        wrapper.appendChild(button);
        section.appendChild(wrapper);
      }
    }
  }

  // injectRetryUI removed; kept inline in loadSection() to avoid small helper function

  async function retrySection(section) {
    section.querySelectorAll(".section-error-box").forEach((el) => el.remove());
    section.dataset.state = "";
    loadedSections.delete(section);
    retryAttempts.delete(section);
    await loadSection(section);
  }

  function init() {
    if (init._initialized) return;
    init._initialized = true;

    const sections = Array.from(document.querySelectorAll(SELECTOR));
    const eagerSections = [];
    const lazySections = [];

    sections.forEach((section) => {
      if (section.dataset.eager !== undefined) {
        eagerSections.push(section);
      } else {
        lazySections.push(section);
      }
    });

    eagerSections.forEach(loadSection);

    if (lazySections.length) {
      const observer = createLazyLoadObserver(loadSection);
      lazySections.forEach((section) => observer.observe(section));
    }
  }

  function reinit() {
    init._initialized = false;
    init();
  }

  const api = { init, reinit, loadSection, retrySection };
  // Export to globalThis for compatibility with inline handlers if any, but prefer ES import
  globalThis.SectionLoader = api;
  return api;
})();

function _initApp() {
  SectionLoader.init();
  // Ensure accessibility preferences applied right away
  try {
    a11y?.updateAnimations?.();
    a11y?.updateContrast?.();
  } catch {
    /* ignored */
  }
}

if (document.readyState !== "loading") {
  _initApp();
} else {
  document.addEventListener(EVENTS.DOM_READY, _initApp, { once: true });
}

// ===== Scroll Snapping =====
const ScrollSnapping = (() => {
  let snapTimer = null;
  const snapContainer =
    document.querySelector(".snap-container") || document.documentElement;

  const disableSnap = () => snapContainer.classList.add("no-snap");
  const enableSnap = () => snapContainer.classList.remove("no-snap");

  function handleScroll() {
    disableSnap();
    clearTimeout(snapTimer);
    snapTimer = setTimeout(enableSnap, 180);
  }

  function handleKey(event) {
    const scrollKeys = [
      "PageDown",
      "PageUp",
      "Home",
      "End",
      "ArrowDown",
      "ArrowUp",
      "Space",
    ];
    if (scrollKeys.includes(event.key)) {
      handleScroll();
    }
  }

  function init() {
    globalThis.addEventListener("wheel", handleScroll, { passive: true });
    globalThis.addEventListener("touchmove", handleScroll, { passive: true });
    globalThis.addEventListener("keydown", handleKey, { passive: true });
  }

  return { init };
})();

ScrollSnapping.init();

// ===== Loading Screen Manager =====
const LoadingScreenManager = (() => {
  const MIN_DISPLAY_TIME = 600;
  const state = {
    overlay: null,
    bar: null,
    text: null,
    percent: null,
    progress: 0,
    interval: null,
    messageIndex: 0,
    messages: [
      "Initialisiere System...",
      "Assets werden geladen...",
      "Verbinde Neural Interface...",
      "Rendere 3D-Umgebung...",
      "Optimiere Shader...",
      "Starte KI-Module...",
      "Synchronisiere Daten...",
    ],
  };

  let startTime = 0;
  let hasHidden = false;

  function bindElements() {
    state.overlay = getElementById("app-loader");
    state.bar = getElementById("loader-progress-bar");
    state.text = getElementById("loader-status-text");
    state.percent = getElementById("loader-percentage");
    return Boolean(state.overlay);
  }

  function updateUI(statusText) {
    if (state.bar) state.bar.style.width = `${Math.floor(state.progress)}%`;
    if (state.percent)
      state.percent.textContent = `${Math.floor(state.progress)}%`;
    if (statusText && state.text) state.text.textContent = statusText;
  }

  function stopSimulation() {
    if (state.interval) {
      clearInterval(state.interval);
      state.interval = null;
    }
  }

  function startSimulation() {
    if (!state.overlay) return;

    stopSimulation();
    state.progress = 0;
    state.messageIndex = 0;
    state.overlay.classList.remove("fade-out");
    state.overlay.style.display = "flex";
    state.overlay.removeAttribute("aria-hidden");
    updateUI(state.messages[state.messageIndex]);

    state.interval = setInterval(() => {
      const increment = Math.random() * (state.progress > 70 ? 2 : 5);
      const ceiling = 96;
      const next = Math.min(state.progress + increment, ceiling);
      state.progress = Math.max(state.progress, next);

      // Rotate messages for a subtle "system" feel
      if (Math.random() > 0.8 && state.progress < 94) {
        state.messageIndex = (state.messageIndex + 1) % state.messages.length;
        updateUI(state.messages[state.messageIndex]);
      } else {
        updateUI();
      }
    }, 120);
  }

  function finalizeProgress(statusText = "Bereit.") {
    stopSimulation();
    state.progress = 100;
    updateUI(statusText);
  }

  function hide() {
    if (hasHidden) return;
    if (!state.overlay) return;

    const elapsed = performance.now() - startTime;
    const delay = Math.max(0, MIN_DISPLAY_TIME - elapsed);

    setTimeout(() => {
      // If there's an Earth container on the page, wait up to 4s for the
      // 'earth-ready' signal (or compatible signals) to avoid hiding the
      // loader before the 3D canvas can show a visible frame.
      const earthContainerPresent =
        document.getElementById("threeEarthContainer") ||
        document.getElementById("earth-container");

      const proceedToHide = () => {
        if (hasHidden) return;
        hasHidden = true;
        finalizeProgress();

        state.overlay.classList.add("fade-out");
        state.overlay.setAttribute("aria-hidden", "true");
        state.overlay.dataset.loaderDone = "true";

        const cleanup = () => {
          state.overlay.style.display = "none";
          state.overlay.removeEventListener("transitionend", cleanup);
        };

        state.overlay.addEventListener("transitionend", cleanup);
        setTimeout(cleanup, 900);

        try {
          document.body.classList.remove("global-loading-visible");
        } catch {
          /* ignore */
        }

        perfMarks.loadingHidden = performance.now();
        announce("Anwendung geladen", { dedupe: true });
        fire(EVENTS.LOADING_HIDE);
        globalThis.dispatchEvent(new Event("app-ready"));
      };

      if (!earthContainerPresent) {
        proceedToHide();
        return;
      }

      // Wait for one of the ready signals with a safety timeout
      let settled = false;
      const settle = () => {
        if (settled) return;
        settled = true;
        proceedToHide();
      };

      const timeoutMs = 4000;
      const t = setTimeout(() => {
        try {
          console.warn("Earth load timeout - proceeding anyway");
        } catch {}
        settle();
      }, timeoutMs);

      const onReady = () => {
        clearTimeout(t);
        settle();
      };

      window.addEventListener("earth-ready", onReady, { once: true });
      window.addEventListener("three-first-frame", onReady, { once: true });
      window.addEventListener("three-ready", onReady, { once: true });
    }, delay);
  }

  function init() {
    startTime = performance.now();
    if (!bindElements()) return;

    try {
      document.body.classList.add("global-loading-visible");
    } catch {
      /* ignore */
    }

    startSimulation();
  }

  function setStatus(message, progress) {
    if (!state.overlay || hasHidden) return;

    if (typeof progress === "number") {
      state.progress = Math.min(Math.max(progress, state.progress), 98);
    }

    updateUI(message);
  }

  return { init, hide, setStatus };
})();

// ===== Three.js Earth System Loader =====
const ThreeEarthLoader = (() => {
  let cleanupFn = null;
  let isLoading = false;

  async function load() {
    if (isLoading || cleanupFn) return;

    // Explicitly check env for testing to skip heavy WebGL
    // ALLOW for specific verification script if requested via global override
    if (ENV.isTest && !globalThis.__FORCE_THREE_EARTH) {
      log.info(
        "Test environment detected - skipping Three.js Earth system for performance"
      );
      return;
    }

    const container = getElementById("threeEarthContainer");
    if (!container) {
      log.debug("Earth container not found");
      return;
    }

    // Performance guard: skip Three.js on small viewports or when user enabled save-data
    try {
      if (navigator.connection?.saveData) {
        log.info("Three.js skipped: save-data mode detected");
        return;
      }
    } catch (err) {
      log.warn("Three.js guard check failed", err);
    }

    isLoading = true;

    try {
      log.info("Loading Three.js Earth system...");
      const module = await import(
        "./components/particles/three-earth-system.js"
      );
      const ThreeEarthManager = module.default;

      cleanupFn = await ThreeEarthManager.initThreeEarth();

      if (typeof cleanupFn === "function") {
        // Export the cleanup function for programmatic control
        __threeEarthCleanup = cleanupFn;
        // Optionally expose in debug mode for backwards compatibility
        if (ENV.debug) globalThis.__threeEarthCleanup = cleanupFn;

        log.info("Three.js Earth system initialized");
        perfMarks.threeJsLoaded = performance.now();
      }
    } catch (error) {
      log.warn("Three.js failed, using CSS fallback:", error);
    } finally {
      isLoading = false;
    }
  }

  function init() {
    const container = getElementById("threeEarthContainer");
    if (!container) return;

    // Immediate visibility check: if the container is already within the
    // rootMargin area *or* the global loader is still visible, trigger load
    // immediately so the Earth is prepared while the loader is active.
    try {
      const rect = container.getBoundingClientRect();
      const withinMargin =
        rect.top < (globalThis.innerHeight || 0) + 100 && rect.bottom > -100;
      const loaderVisible =
        document.getElementById("app-loader")?.dataset?.loaderDone !== "true";

      if (withinMargin || loaderVisible) {
        load();
        return;
      }
    } catch (e) {
      // ignore and fallback to observer
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            observer.disconnect();
            load();
          }
        }
      },
      { rootMargin: "100px", threshold: 0.01 }
    );

    observer.observe(container);
  }

  function initDelayed() {
    if (globalThis.requestIdleCallback) {
      requestIdleCallback(init, { timeout: 2000 });
    } else {
      setTimeout(init, 1000);
    }
  }

  return { initDelayed };
})();

// ===== Application Bootstrap =====
document.addEventListener(
  "DOMContentLoaded",
  async () => {
    perfMarks.domReady = performance.now();
    LoadingScreenManager.init();

    fire(EVENTS.DOM_READY);

    // Simplified TypeWriter Export — legacy global exposure removed; prefer importing initHeroSubtitle where needed.

    let modulesReady = false;
    let windowLoaded = false;

    const checkReady = () => {
      if (!modulesReady || !windowLoaded) return;
      if (AppLoadManager.isBlocked()) return;
      LoadingScreenManager.setStatus("Starte Experience...", 98);
      LoadingScreenManager.hide();
    };

    document.addEventListener(EVENTS.LOADING_UNBLOCKED, checkReady);

    globalThis.addEventListener(
      "load",
      () => {
        perfMarks.windowLoaded = performance.now();
        windowLoaded = true;
        LoadingScreenManager.setStatus("Finalisiere Assets...", 92);
        checkReady();
      },
      { once: true }
    );

    fire(EVENTS.CORE_INITIALIZED);

    fire(EVENTS.HERO_INIT_READY);
    initHeroFeatureBundle();

    ThreeEarthLoader.initDelayed();

    modulesReady = true;
    perfMarks.modulesReady = performance.now();
    LoadingScreenManager.setStatus("Initialisiere 3D-Engine...", 90);
    fire(EVENTS.MODULES_READY);
    checkReady();
    (function scheduleSmartForceHide(attempt = 1) {
      const DEFAULT_INITIAL_DELAY = 5000;
      const EXTENDED_INITIAL_DELAY = 8000; // give heavier modules (three-earth) more time on slower hosts
      const RETRY_DELAY = 5000;
      const MAX_ATTEMPTS = 3;

      // Compute delay dynamically in case heavier modules are still blocking
      const computeDelay = () => {
        try {
          if (
            AppLoadManager !== undefined &&
            typeof AppLoadManager.getPending === "function"
          ) {
            const pending = AppLoadManager.getPending() || [];
            if (pending.includes("three-earth")) return EXTENDED_INITIAL_DELAY;
          }
        } catch (err) {
          /* ignore and fall back to default */
        }
        return DEFAULT_INITIAL_DELAY;
      };

      const initialDelay = computeDelay();

      setTimeout(
        () => {
          if (windowLoaded) return;

          // If other modules registered as blocking, defer forced hide and retry
          try {
            // Ensure AppLoadManager exists and is callable before using it (some environments may not register it)
            if (
              AppLoadManager !== undefined &&
              typeof AppLoadManager.isBlocked === "function" &&
              AppLoadManager.isBlocked?.()
            ) {
              const pending =
                typeof AppLoadManager.getPending === "function"
                  ? AppLoadManager.getPending()
                  : [];
              log.warn(
                `Deferring forced loading screen hide (attempt ${attempt}): blocking modules=${
                  Array.isArray(pending) ? pending.join(", ") : String(pending)
                }`
              );

              if (attempt < MAX_ATTEMPTS) {
                scheduleSmartForceHide(attempt + 1);
                return;
              }
              log.warn(
                "Max attempts reached - forcing hide despite blocking modules"
              );
            }
          } catch (e) {
            log.debug(
              "AppLoadManager not available or check failed (expected in some environments)",
              e
            );
          }

          log.warn("Forcing loading screen hide after timeout");
          // Force-hide now
          LoadingScreenManager.setStatus("Schließe Ladebildschirm...");
          LoadingScreenManager.hide();
        },
        attempt === 1 ? initialDelay : RETRY_DELAY
      );
    })();

    schedulePersistentStorageRequest(2200);

    // Activate deferred styles that were marked with data-defer="1"
    const activateDeferredStyles = () => {
      try {
        const links = document.querySelectorAll(
          'link[rel="stylesheet"][data-defer="1"]'
        );
        links.forEach((link) => {
          try {
            link.media = "all";
            delete link.dataset.defer;
          } catch {
            /* ignore individual link errors */
          }
        });
      } catch {
        /* ignore */
      }
    };

    try {
      // Try activating now (covers case where links are already in DOM)
      activateDeferredStyles();

      // Ensure activation after DOM is parsed and on full load
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", activateDeferredStyles, {
          once: true,
        });
      } else {
        // In case script executed after parsing, ensure microtask activation
        setTimeout(activateDeferredStyles, 0);
      }
      globalThis.addEventListener("load", activateDeferredStyles);

      // Observe head for dynamically inserted deferred link elements
      const headObserver = new MutationObserver((mutations) => {
        for (const m of mutations) {
          for (const node of m.addedNodes) {
            try {
              if (
                node.nodeType === 1 &&
                node.matches?.('link[rel="stylesheet"][data-defer="1"]')
              ) {
                node.media = "all";
                delete node.dataset.defer;
              }
            } catch {
              /* ignore per-node errors */
            }
          }
        }
      });
      headObserver.observe(document.head || document.documentElement, {
        childList: true,
        subtree: true,
      });
      // Disconnect after full load to avoid long-running observers
      globalThis.addEventListener("load", () => headObserver.disconnect(), {
        once: true,
      });
    } catch {
      /* ignore overall activation errors */
    }

    // Delegated handlers for retry and share buttons to avoid inline handlers (CSP-compliant)
    document.addEventListener("click", (event) => {
      const target = event.target;
      if (!target) return;

      // Retry / reload buttons (class-based)
      const retry = target?.closest(".retry-btn");
      if (retry) {
        event.preventDefault();
        try {
          globalThis.location.reload();
        } catch {
          // fallback - do nothing, reload failed
        }
        return;
      }

      // Share button (degraded to clipboard if navigator.share not available)
      const share = target?.closest(".btn-share");
      if (share) {
        event.preventDefault();
        const shareUrl =
          share.dataset.shareUrl || "https://www.youtube.com/@aks.030";
        const shareData = {
          title: document.title,
          text: "Schau dir diesen Kanal an",
          url: shareUrl,
        };

        if (navigator.share) {
          navigator
            .share(shareData)
            .catch((err) => log.warn("share failed", err));
        } else if (navigator.clipboard) {
          navigator.clipboard.writeText(shareUrl).then(() => {
            try {
              announce("Link kopiert", { dedupe: true });
            } catch (err) {
              log.warn("announce failed", err);
            }
          });
        } else {
          try {
            globalThis.prompt("Link kopieren", shareUrl);
          } catch (err) {
            log.warn("prompt failed", err);
          }
        }
      }
    });

    log.info("Performance:", {
      domReady: Math.round(perfMarks.domReady - perfMarks.start),
      modulesReady: Math.round(perfMarks.modulesReady - perfMarks.start),
      windowLoaded: Math.round(perfMarks.windowLoaded - perfMarks.start),
    });

    // Dev-only ReconnectingWebSocket helper removed (was used for ?ws-test / local debug).
  },
  { once: true }
);

// ===== BFCache / Back Button Handling =====
// Ensure Three.js system is resilient when navigating back
globalThis.addEventListener("pageshow", (event) => {
  if (event.persisted) {
    log.info("Page restored from bfcache");
    // If we have a cleanup function, it means it was running.
    // If the browser froze the state, it might just resume.
    // However, we want to ensure interactions are active.

    // Force a resize event to re-calibrate camera/renderer
    globalThis.dispatchEvent(new CustomEvent("resize"));

    // Re-check visibility
    if (
      !document.hidden &&
      globalThis.threeEarthSystem &&
      globalThis.threeEarthSystem.animate
    ) {
      // If system exposed an animate function, we could call it, but the loop usually uses rAF
      // which might have been paused.
      // The visibilitychange handler should pick this up, but let's trigger it.
      document.dispatchEvent(new CustomEvent("visibilitychange"));
    }
  }
});
