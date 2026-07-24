/**
 * Three.js Earth Manager
 * @version 1.2.0
 */

import {
  cancelIdleTask,
  getElementById,
  scheduleIdleTask,
  TimerManager,
  upsertHeadLink,
} from "../../../core/utils/index.js";
import { createLogger } from "../../../core/logger.js";
import { AppLoadManager } from "../../../core/load-manager.js";
import { EARTH_PRIMARY_TEXTURE_URL, EARTH_SECONDARY_TEXTURE_URLS } from "../earth/texture-paths.js";

const log = createLogger("ThreeEarthManager");

function isForceThreeEnabled() {
  return new URL(globalThis.location.href).searchParams.get("forceThree") === "1";
}

export class ThreeEarthManager {
  /**
   * @param {Object} env - Environment configuration object
   */
  constructor(env) {
    this.env = env;
    this.cleanupFn = null;
    this.isLoading = false;
    this.timers = new TimerManager("ThreeEarthManager");
    this.deferObserver = null;
    this.deferIdleHandle = null;
    this.deferIntentCleanup = null;
  }

  getContainer() {
    return getElementById("threeEarthContainer") || getElementById("earth-container");
  }

  async load() {
    if (this.isLoading || this.cleanupFn) return;
    this.clearDeferredLoadHooks();

    if (this.env.isTest && !isForceThreeEnabled()) {
      log.info("Test environment - skipping Three.js Earth");
      return;
    }

    const container = this.getContainer();
    if (!container) {
      log.debug("Earth container not found");
      return;
    }

    const networkNavigator = /** @type {Navigator & { connection?: { saveData?: boolean } }} */ (
      navigator
    );
    if (networkNavigator.connection?.saveData) {
      log.info("Three.js skipped: save-data mode");
      this.announce("3D-Darstellung deaktiviert — Datensparmodus aktiv");
      return;
    }

    this.isLoading = true;
    AppLoadManager.block("three-earth");

    // Preload the primary texture immediately when earth loading starts
    this.preloadTextures();

    // Set loading timeout to prevent indefinite readiness gating
    const loadingTimeout = this.timers.setTimeout(() => {
      log.warn("Three.js Earth loading timeout, clearing readiness block");
      AppLoadManager.unblock("three-earth");
    }, 6000); // 6 second timeout for earth loading

    try {
      log.info("Loading Three.js Earth system...");
      const { initThreeEarth } = await import("../three-earth-system.js");

      if (typeof initThreeEarth !== "function") {
        throw new Error("initThreeEarth not found in module exports");
      }

      this.cleanupFn = await initThreeEarth();

      if (typeof this.cleanupFn === "function") {
        log.info("Three.js Earth system initialized");
        this.announce("Interaktive 3D-Erde geladen");
      }
    } catch (error) {
      log.warn("Three.js failed, using CSS fallback:", error);
      this.announce("CSS-Modus aktiv — 3D-Ansicht nicht verfügbar");
      // Unblock loader even on error
      AppLoadManager.unblock("three-earth");
    } finally {
      this.timers.clearTimeout(loadingTimeout);
      this.isLoading = false;
    }
  }

  preloadTextures() {
    // Avoid late-preload console warnings: only preload before window load fires.
    // Three.js image loading uses anonymous CORS, so match that on the hint.
    const canPreloadNow = document.readyState !== "complete";
    if (canPreloadNow) {
      upsertHeadLink({
        rel: "preload",
        href: EARTH_PRIMARY_TEXTURE_URL,
        as: "image",
        crossOrigin: "anonymous",
        dataset: { injectedBy: "three-earth" },
        attrs: { fetchpriority: "high" },
      });
    }

    // Secondary textures are queued as low-priority prefetches.
    EARTH_SECONDARY_TEXTURE_URLS.forEach(href => {
      upsertHeadLink({
        rel: "prefetch",
        href,
        as: "image",
        dataset: { injectedBy: "three-earth" },
      });
    });
  }

  init() {
    const container = this.getContainer();
    if (!container) return;
    if (this.isLoading || this.cleanupFn) return;

    const startLoad = () => {
      this.load();
    };

    // Load immediately using a short idle task to prioritize the main thread for initial render
    this.deferIdleHandle = scheduleIdleTask(
      () => {
        startLoad();
      },
      {
        timeout: 100,
        fallbackDelay: 100,
        setTimeoutFn: this.timers.setTimeout.bind(this.timers),
        clearTimeoutFn: this.timers.clearTimeout.bind(this.timers),
      }
    );
  }

  clearDeferredLoadHooks() {
    if (this.deferObserver) {
      this.deferObserver.disconnect();
      this.deferObserver = null;
    }

    cancelIdleTask(this.deferIdleHandle);
    this.deferIdleHandle = null;

    if (this.deferIntentCleanup) {
      this.deferIntentCleanup();
    }
  }

  async cleanup() {
    this.timers.clearAll();
    this.clearDeferredLoadHooks();
    if (this.cleanupFn) {
      try {
        this.cleanupFn();
        this.cleanupFn = null;
        log.info("Three.js Earth cleaned up");
      } catch (error) {
        log.warn("Cleanup failed:", error);
      }
    }
  }

  /**
   * Announce state change via ARIA live region
   * @param {string} message
   */
  announce(message) {
    try {
      if (typeof globalThis.announce === "function") {
        globalThis.announce(message, { dedupe: true });
      }
    } catch {
      /* ignore */
    }
  }
}
