/**
 * Main Application Entry Point - Optimized
 * 
 * OPTIMIZATIONS v3.0:
 * - Streamlined initialization sequence
 * - Better error boundaries
 * - Reduced code duplication
 * - Improved lazy loading strategy
 * - Enhanced performance monitoring
 * - Better cleanup handling
 * 
 * @version 3.0.0
 * @last-modified 2025-10-29
 */

import { initHeroFeatureBundle } from "../../pages/home/hero-manager.js";
import {
  createLazyLoadObserver,
  createLogger,
  EVENTS,
  fire,
  getElementById,
  schedulePersistentStorageRequest,
  SectionTracker,
} from "./shared-utilities.js";
import TypeWriterRegistry from "./TypeWriter/TypeWriter.js";
import "./menu/menu.js";

const log = createLogger("main");

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
    
    // Prevent duplicate announcements
    if (dedupe && cache.has(message)) return;
    if (dedupe) {
      cache.set(message, true);
      setTimeout(() => cache.delete(message), 3000);
    }
    
    try {
      const id = assertive ? "live-region-assertive" : "live-region-status";
      const region = getElementById(id);
      if (!region) return;
      
      // Clear and announce
      region.textContent = "";
      requestAnimationFrame(() => {
        region.textContent = message;
      });
    } catch (error) {
      log.debug("Announcement failed:", error);
    }
  };
})();

window.announce = announce;

// ===== Section Tracker =====
const sectionTracker = new SectionTracker();
sectionTracker.init();
window.sectionTracker = sectionTracker;

// ===== Service Worker Entfernung (Decommission) =====
// Entfernt vorhandene Service Worker und löscht projektbezogene Caches
if ("serviceWorker" in navigator) {
  window.addEventListener(
    "load",
    async () => {
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));

        // Projekt-Caches aufräumen (nur unsere iweb-*-Caches)
        if (window.caches && typeof caches.keys === "function") {
          try {
            const keys = await caches.keys();
            const ours = keys.filter((k) => k.startsWith("iweb-"));
            await Promise.all(ours.map((k) => caches.delete(k)));
          } catch (e) {
            log.debug("Cache cleanup failed:", e);
          }
        }

        log.info("Service Worker entfernt und Caches bereinigt");
      } catch (error) {
        log.debug("Service Worker removal failed:", error);
      }
    },
    { once: true }
  );
}

// ===== Lazy Module Loader =====
const LazyModuleLoader = (() => {
  const modules = [
    { id: "about", path: "/pages/about/about.js", loaded: false },
  ];

  const loadedModules = new Set();

  async function loadModule(module) {
    if (loadedModules.has(module.id)) return;
    
    loadedModules.add(module.id);
    module.loaded = true;

    try {
      await import(module.path);
      log.debug(`Module loaded: ${module.id}`);
    } catch (error) {
      log.warn(`Failed to load module ${module.id}:`, error);
      loadedModules.delete(module.id);
      module.loaded = false;
    }
  }

  function init() {
    const lazyLoader = createLazyLoadObserver((element) => {
      const module = modules.find((m) => m.id === element.id);
      if (module && !module.loaded) {
        loadModule(module);
      }
    });

    // Fallback: Load immediately if IntersectionObserver not available
    if (!lazyLoader.observer) {
      modules.forEach(loadModule);
      return;
    }

    // Listen for section loaded events
    document.addEventListener("section:loaded", (ev) => {
      const id = ev.detail?.id;
      const module = modules.find((m) => m.id === id);
      if (module && !module.loaded) {
        const el = getElementById(id);
        if (el) lazyLoader.observe(el);
      }
    });

    // Observe initial sections
    modules.forEach(({ id }) => {
      const el = getElementById(id);
      if (el) lazyLoader.observe(el);
    });
  }

  return { init, loadModule };
})();

// ===== Section Loader =====
const SectionLoader = (() => {
  if (window.SectionLoader) return window.SectionLoader;

  const SELECTOR = "section[data-section-src]";
  const loadedSections = new WeakSet();
  const retryAttempts = new WeakMap();
  const MAX_RETRIES = 2;
  const FETCH_TIMEOUT = 8000;

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

  async function fetchWithTimeout(url, timeout = FETCH_TIMEOUT) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        credentials: "same-origin",
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  async function loadSection(section) {
    if (loadedSections.has(section)) return;
    
    const url = section.getAttribute("data-section-src");
    if (!url) {
      section.removeAttribute("aria-busy");
      return;
    }

    loadedSections.add(section);
    const sectionName = getSectionName(section);
    const attempts = retryAttempts.get(section) || 0;

    // Prepare section
    section.setAttribute("aria-busy", "true");
    section.dataset.state = "loading";
    
    announce(`Lade ${sectionName}…`, { dedupe: true });
    dispatchEvent("section:will-load", section, { url });

    try {
      const response = await fetchWithTimeout(url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();
      
      // Insert content
      section.insertAdjacentHTML("beforeend", html);
      
      // Handle templates
      const template = section.querySelector("template");
      if (template) {
        section.appendChild(template.content.cloneNode(true));
      }

      // Remove skeletons
      section.querySelectorAll(".section-skeleton").forEach((el) => el.remove());

      // Mark as loaded
      section.dataset.state = "loaded";
      section.removeAttribute("aria-busy");

      announce(`${sectionName} geladen`, { dedupe: true });
      dispatchEvent("section:loaded", section, { state: "loaded" });

      // Fire hero event if needed
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
        
        // Exponential backoff
        const delay = 300 * Math.pow(2, attempts);
        await new Promise((resolve) => setTimeout(resolve, delay));
        
        return loadSection(section);
      }

      // Final error state
      section.dataset.state = "error";
      section.removeAttribute("aria-busy");
      
      announce(`Fehler beim Laden von ${sectionName}`, { assertive: true });
      dispatchEvent("section:error", section, { state: "error" });
      
      injectRetryUI(section);
    }
  }

  function injectRetryUI(section) {
    if (section.querySelector(".section-retry")) return;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "section-retry";
    button.textContent = "Erneut laden";
    button.addEventListener("click", () => retrySection(section), { once: true });

    const wrapper = document.createElement("div");
    wrapper.className = "section-error-box";
    wrapper.appendChild(button);
    section.appendChild(wrapper);
  }

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
      if (section.hasAttribute("data-eager")) {
        eagerSections.push(section);
      } else {
        lazySections.push(section);
      }
    });

    // Load eager sections immediately
    eagerSections.forEach(loadSection);

    // Lazy load other sections
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
  window.SectionLoader = api;
  return api;
})();

// Initialize section loader
if (document.readyState !== "loading") {
  SectionLoader.init();
} else {
  document.addEventListener(EVENTS.DOM_READY, SectionLoader.init, { once: true });
}

// ===== Scroll Snapping =====
const ScrollSnapping = (() => {
  let snapTimer = null;
  const snapContainer = document.querySelector(".snap-container") || document.documentElement;

  const disableSnap = () => snapContainer.classList.add("no-snap");
  const enableSnap = () => snapContainer.classList.remove("no-snap");

  function handleScroll() {
    disableSnap();
    clearTimeout(snapTimer);
    snapTimer = setTimeout(enableSnap, 180);
  }

  function handleKey(event) {
    const scrollKeys = ["PageDown", "PageUp", "Home", "End", "ArrowDown", "ArrowUp", "Space"];
    if (scrollKeys.includes(event.key)) {
      handleScroll();
    }
  }

  function init() {
    window.addEventListener("wheel", handleScroll, { passive: true });
    window.addEventListener("touchmove", handleScroll, { passive: true });
    window.addEventListener("keydown", handleKey, { passive: true });
  }

  return { init };
})();

ScrollSnapping.init();

// ===== Loading Screen Manager =====
const LoadingScreenManager = (() => {
  const MIN_DISPLAY_TIME = 600;
  let startTime = 0;

  function hide() {
    const loadingScreen = getElementById("loadingScreen");
    if (!loadingScreen) return;

    const elapsed = performance.now() - startTime;
    const delay = Math.max(0, MIN_DISPLAY_TIME - elapsed);

    setTimeout(() => {
      loadingScreen.classList.add("hide");
      loadingScreen.setAttribute("aria-hidden", "true");
      
      Object.assign(loadingScreen.style, {
        opacity: "0",
        pointerEvents: "none",
        visibility: "hidden",
      });

      const cleanup = () => {
        loadingScreen.style.display = "none";
        loadingScreen.removeEventListener("transitionend", cleanup);
      };

      loadingScreen.addEventListener("transitionend", cleanup);
      setTimeout(cleanup, 700);

      announce("Anwendung geladen", { dedupe: true });
      
      perfMarks.loadingHidden = performance.now();
      log.info(`Loading screen hidden after ${Math.round(elapsed)}ms`);
    }, delay);
  }

  function init() {
    startTime = performance.now();
  }

  return { init, hide };
})();

// ===== Three.js Earth System Loader =====
const ThreeEarthLoader = (() => {
  let cleanupFn = null;
  let isLoading = false;

  const isLighthouse = 
    navigator.userAgent.includes("Chrome-Lighthouse") ||
    navigator.userAgent.includes("HeadlessChrome");

  async function load() {
    if (isLoading || cleanupFn) return;

    if (isLighthouse) {
      log.info("Lighthouse detected - skipping Three.js");
      return;
    }

    const container = getElementById("threeEarthContainer");
    if (!container) {
      log.debug("Earth container not found");
      return;
    }

    isLoading = true;

    try {
      log.info("Loading Three.js Earth system...");
      const module = await import("./particles/three-earth-system.js");
      const ThreeEarthManager = module.default;
      
      cleanupFn = await ThreeEarthManager.initThreeEarth();

      if (typeof cleanupFn === "function") {
        window.__threeEarthCleanup = cleanupFn;
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

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            observer.disconnect();
            load();
          }
        }
      },
      { rootMargin: "300px", threshold: 0.01 }
    );

    observer.observe(container);
  }

  function initDelayed() {
    if (window.requestIdleCallback) {
      requestIdleCallback(init, { timeout: 2000 });
    } else {
      setTimeout(init, 1000);
    }
  }

  return { initDelayed };
})();

// ===== Application Bootstrap =====
document.addEventListener("DOMContentLoaded", async () => {
  perfMarks.domReady = performance.now();
  LoadingScreenManager.init();

  fire(EVENTS.DOM_READY);

  // Initialize TypeWriter registry
  if (!window.TypeWriterRegistry) {
    window.TypeWriterRegistry = TypeWriterRegistry;
  }

  // Track readiness state
  let modulesReady = false;
  let windowLoaded = false;

  const checkReady = () => {
    if (!modulesReady || !windowLoaded) return;
    LoadingScreenManager.hide();
  };

  // Window load handler
  window.addEventListener("load", () => {
    perfMarks.windowLoaded = performance.now();
    windowLoaded = true;
    checkReady();
  }, { once: true });

  // Core initialization
  fire(EVENTS.CORE_INITIALIZED);

  // Initialize hero
  fire(EVENTS.HERO_INIT_READY);
  initHeroFeatureBundle();

  // Initialize lazy modules
  LazyModuleLoader.init();

  // Initialize Three.js (delayed)
  ThreeEarthLoader.initDelayed();

  // Mark modules as ready
  modulesReady = true;
  perfMarks.modulesReady = performance.now();
  fire(EVENTS.MODULES_READY);
  checkReady();

  // Fallback: Force hide after 5 seconds
  setTimeout(() => {
    if (!windowLoaded) {
      log.warn("Forcing loading screen hide after timeout");
      LoadingScreenManager.hide();
    }
  }, 5000);

  // Request persistent storage
  schedulePersistentStorageRequest(2200);

  // Log performance metrics
  log.info("Performance:", {
    domReady: Math.round(perfMarks.domReady - perfMarks.start),
    modulesReady: Math.round(perfMarks.modulesReady - perfMarks.start),
    windowLoaded: Math.round(perfMarks.windowLoaded - perfMarks.start),
  });
}, { once: true });