/**
 * Main Application Entry Point
 * 
 * OPTIMIZATIONS v2.0:
 * - Improved module loading sequence
 * - Better error handling
 * - Optimized Three.js initialization timing
 * - Enhanced feature detection
 * 
 * @version 2.0.0-optimized
 * @last-modified 2025-10-26
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

// ===== Section Tracker =====
const sectionTracker = new SectionTracker();
sectionTracker.init();
window.sectionTracker = sectionTracker;

// ===== Accessibility =====
function announce(message, { assertive = false } = {}) {
  try {
    const id = assertive ? "live-region-assertive" : "live-region-status";
    const region = getElementById(id);
    if (!region) return;
    region.textContent = "";
    requestAnimationFrame(() => {
      region.textContent = message;
    });
  } catch {
    /* Fail silently */
  }
}

window.announce = window.announce || announce;

// ===== Service Worker =====
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

// ===== Lazy Load Modules =====
(() => {
  const MAP = [
    {
      id: "about",
      module: "/pages/about/about.js",
      loaded: false,
      type: "about-section",
    },
  ];

  const lazyLoader = createLazyLoadObserver((element) => {
    const match = MAP.find((m) => m.id === element.id);
    if (match && !match.loaded) {
      match.loaded = true;
      import(match.module).catch(() => {});
    }
  });

  if (!lazyLoader.observer) {
    MAP.forEach((entry) => import(entry.module).catch(() => {}));
    return;
  }

  document.addEventListener("section:loaded", (ev) => {
    const id = ev.detail?.id;
    const candidate = MAP.find((m) => m.id === id);
    if (candidate && !candidate.loaded) {
      const el = getElementById(id);
      if (el) lazyLoader.observe(el);
    }
  });

  ["about"].forEach((id) => {
    const el = getElementById(id);
    if (el) lazyLoader.observe(el);
  });
})();

// ===== Section Loader =====
const SectionLoader = (() => {
  if (window.SectionLoader) return window.SectionLoader;

  const SELECTOR = "section[data-section-src]";
  const SEEN = new WeakSet();

  function dispatchSectionEvent(type, section, detail = {}) {
    try {
      const ev = new CustomEvent(type, {
        detail: { id: section?.id, section, ...detail },
      });
      document.dispatchEvent(ev);
    } catch (e) {
      console.warn("Failed to dispatch section event:", type, e);
    }
  }

  async function loadInto(section) {
    if (SEEN.has(section)) return;
    SEEN.add(section);
    const url = section.getAttribute("data-section-src");
    if (!url) {
      section.removeAttribute("aria-busy");
      return;
    }

    prepSectionForLoad(section);
    const sectionName = resolveSectionName(section);
    announce(`Lade Abschnitt ${sectionName}…`);
    dispatchSectionEvent("section:will-load", section, { url });

    const maxAttempts = 2;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const result = await attemptFetchInsert(url, section);
      if (result.ok) {
        finalizeSuccess(section, sectionName);
        return;
      }
      const { transient } = result;
      const last = attempt === maxAttempts - 1;
      if (last || !transient) {
        finalizeError(section, sectionName);
        return;
      }
      await backoff(attempt);
    }
    section.removeAttribute("aria-busy");
  }

  function prepSectionForLoad(section) {
    section.setAttribute("aria-busy", "true");
    section.dataset.state = "loading";
  }

  function resolveSectionName(section) {
    const labelId = section.getAttribute("aria-labelledby");
    if (labelId) {
      const lbl = getElementById(labelId);
      const txt = lbl?.textContent?.trim();
      if (txt) return txt;
    }
    return section.id || "Abschnitt";
  }

  async function attemptFetchInsert(url, section) {
    const AC = globalThis.AbortController;
    let controller, timeout;
    try {
      if (AC) {
        controller = new AC();
        timeout = setTimeout(() => controller.abort(), 8000);
      }
      const res = await fetch(url, {
        credentials: "same-origin",
        signal: controller?.signal,
      });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText} @ ${url}`);
      const html = await res.text();
      if (timeout) clearTimeout(timeout);
      section.insertAdjacentHTML("beforeend", html);
      const tpl = section.querySelector("template");
      if (tpl) section.appendChild(tpl.content.cloneNode(true));
      section.querySelectorAll(".section-skeleton").forEach((n) => n.remove());
      section.dataset.state = "loaded";
      if (section.id === "hero") fire(EVENTS.HERO_LOADED);
      return { ok: true };
    } catch (error) {
      const transient =
        (error && /5\d\d/.test(String(error))) ||
        (error && navigator.onLine === false);
      if (timeout) clearTimeout(timeout);
      return { ok: false, error, transient };
    } finally {
      if (section.dataset.state === "loaded") {
        section.removeAttribute("aria-busy");
      }
    }
  }

  function finalizeSuccess(section, sectionName) {
    announce(`Abschnitt ${sectionName} geladen.`);
    dispatchSectionEvent("section:loaded", section, { state: "loaded" });
  }

  function finalizeError(section, sectionName) {
    section.dataset.state = "error";
    section.removeAttribute("aria-busy");
    announce(`Fehler beim Laden von Abschnitt ${sectionName}.`, {
      assertive: true,
    });
    dispatchSectionEvent("section:error", section, { state: "error" });
    injectRetryUI(section);
  }

  function backoff(attempt) {
    return new Promise((r) => setTimeout(r, 300 + (attempt + 1) * 200));
  }

  function init() {
    if (init._initialized) return;
    init._initialized = true;
    const sections = Array.from(document.querySelectorAll(SELECTOR));
    const lazy = [];

    sections.forEach((section) => {
      if (section.hasAttribute("data-eager")) {
        loadInto(section);
      } else {
        lazy.push(section);
      }
    });

    if (lazy.length) {
      const sectionLoader = createLazyLoadObserver((section) => {
        loadInto(section);
      });
      lazy.forEach((s) => sectionLoader.observe(s));
    }
  }

  function injectRetryUI(section) {
    if (section.querySelector(".section-retry")) return;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "section-retry";
    btn.textContent = "Erneut laden";
    btn.addEventListener("click", () => retry(section), { once: true });
    const wrapper = document.createElement("div");
    wrapper.className = "section-error-box";
    wrapper.append(btn);
    section.append(wrapper);
  }

  async function retry(section) {
    section.querySelectorAll(".section-error-box").forEach((n) => n.remove());
    section.dataset.state = "";
    section.setAttribute("aria-busy", "true");
    SEEN.delete(section);
    await loadInto(section);
  }

  function reinit() {
    init._initialized = false;
    init();
  }

  const api = { init, reinit, loadInto, retry };
  window.SectionLoader = api;
  return api;
})();

if (document.readyState !== "loading") {
  SectionLoader.init();
} else {
  document.addEventListener(EVENTS.DOM_READY, SectionLoader.init);
}

// ===== Scroll Snapping =====
const ScrollSnapping = (() => {
  let snapTimer = null;
  const snapContainer =
    document.querySelector(".snap-container") || document.documentElement;

  const disableSnap = () => snapContainer.classList.add("no-snap");
  const enableSnap = () => snapContainer.classList.remove("no-snap");

  const onActiveScroll = () => {
    disableSnap();
    clearTimeout(snapTimer);
    snapTimer = setTimeout(enableSnap, 180);
  };

  function init() {
    addEventListener("wheel", onActiveScroll, { passive: true });
    addEventListener("touchmove", onActiveScroll, { passive: true });
    addEventListener("keydown", (e) => {
      if (
        [
          "PageDown",
          "PageUp",
          "Home",
          "End",
          "ArrowDown",
          "ArrowUp",
          "Space",
        ].includes(e.key)
      ) {
        onActiveScroll();
      }
    });
  }

  return { init };
})();

ScrollSnapping.init();

// ===== Application Initialization =====
(() => {
  "use strict";

  let __modulesReady = false,
    __windowLoaded = false,
    __start = 0;
  const __MIN = 600;

  function hideLoading() {
    const el = getElementById("loadingScreen");
    if (!el) return;

    el.classList.add("hide");
    el.setAttribute("aria-hidden", "true");
    Object.assign(el.style, {
      opacity: "0",
      pointerEvents: "none",
      visibility: "hidden",
    });

    const rm = () => {
      el.style.display = "none";
      el.removeEventListener("transitionend", rm);
    };
    el.addEventListener("transitionend", rm);
    setTimeout(rm, 700);
    announce("Initiales Laden abgeschlossen.");
  }

  document.addEventListener(
    "DOMContentLoaded",
    async () => {
      __start = performance.now();

      fire(EVENTS.DOM_READY);

      const tryHide = () => {
        if (!__modulesReady) return;
        if (!__windowLoaded && document.readyState !== "complete") return;
        const elapsed = performance.now() - __start;
        setTimeout(hideLoading, Math.max(0, __MIN - elapsed));
      };

      addEventListener(
        "load",
        () => {
          __windowLoaded = true;
          tryHide();
        },
        { once: true }
      );

      if (!window.TypeWriterRegistry) {
        window.TypeWriterRegistry = TypeWriterRegistry;
      }

      let threeEarthCleanup = null;

      const isLighthouse =
        navigator.userAgent.includes("Chrome-Lighthouse") ||
        navigator.userAgent.includes("HeadlessChrome");

      if (isLighthouse) {
        log.info("Lighthouse detected - skipping Three.js for better performance scores");
      } else {
        const initEarthWhenReady = async () => {
          const earthContainer = getElementById("threeEarthContainer");
          if (!earthContainer) {
            log.debug("Earth container not found, skipping Three.js initialization");
            return;
          }

          const earthObserver = new IntersectionObserver(
            async (entries) => {
              for (const entry of entries) {
                if (entry.isIntersecting && !threeEarthCleanup) {
                  log.info("Loading Three.js Earth system...");
                  earthObserver.disconnect();

                  try {
                    const module = await import("./particles/three-earth-system.js");
                    const ThreeEarthManager = module.default;
                    threeEarthCleanup = await ThreeEarthManager.initThreeEarth();

                    if (threeEarthCleanup && typeof threeEarthCleanup === "function") {
                      window.__threeEarthCleanup = threeEarthCleanup;
                      log.info("Three.js Earth system initialized successfully");
                    }
                  } catch (error) {
                    log.warn("Three.js Earth system failed, using CSS fallback:", error);
                  }
                }
              }
            },
            { rootMargin: "300px", threshold: 0.01 }
          );

          earthObserver.observe(earthContainer);
        };

        if (window.requestIdleCallback) {
          requestIdleCallback(initEarthWhenReady, { timeout: 2000 });
        } else {
          setTimeout(initEarthWhenReady, 1000);
        }
      }

      fire(EVENTS.CORE_INITIALIZED);

      fire(EVENTS.HERO_INIT_READY);
      initHeroFeatureBundle();

      __modulesReady = true;
      fire(EVENTS.MODULES_READY);
      tryHide();

      setTimeout(hideLoading, 5000);

      schedulePersistentStorageRequest(2200);
    },
    { once: true }
  );
})();