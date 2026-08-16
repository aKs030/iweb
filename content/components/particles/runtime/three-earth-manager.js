import {
  cancelIdleTask,
  getElementById,
  scheduleIdleTask,
  TimerManager,
} from "../../../core/utils/index.js";
import { createLogger } from "../../../core/logger.js";
import { AppLoadManager } from "../../../core/load-manager.js";

const log = createLogger("ThreeEarthManager");
const EARTH_LOAD_KEY = "three-earth";
const EARTH_LOAD_TIMEOUT_MS = 20000;

function isForceThreeEnabled() {
  return new URL(globalThis.location.href).searchParams.get("forceThree") === "1";
}

export class ThreeEarthManager {
  constructor(env) {
    this.env = env;
    this.cleanupFn = null;
    this.isLoading = false;
    this.timers = new TimerManager("ThreeEarthManager");
    this.deferIdleHandle = null;
    this.loadGeneration = 0;
    this.loadPromise = null;
    this.loadAbortController = null;
    this.cleanupPromise = null;
    this.cancelReadiness = null;
    this.onRetryRequest = event => {
      const promise = this.load();
      if (event instanceof CustomEvent && event.detail) event.detail.promise = promise;
    };
  }

  getContainer() {
    return getElementById("threeEarthContainer") || getElementById("earth-container");
  }

  async load() {
    if (this.cleanupPromise) await this.cleanupPromise;
    if (this.isLoading) return;
    this.clearDeferredLoadHooks();

    if (this.env.isTest && !isForceThreeEnabled()) return;

    const container = this.getContainer();
    if (!container) return;
    const networkNavigator = /** @type {Navigator & { connection?: { saveData?: boolean } }} */ (
      navigator
    );
    const reducedData = Boolean(globalThis.matchMedia?.("(prefers-reduced-data: reduce)")?.matches);
    if (networkNavigator.connection?.saveData || reducedData) {
      this.announce("3D-Darstellung deaktiviert — Datensparmodus aktiv");
      return;
    }

    if (this.cleanupFn && !this.isTerminalUnavailable(container)) return;
    const generation = ++this.loadGeneration;
    this.isLoading = true;
    if (this.cleanupFn) {
      const staleCleanup = this.cleanupFn;
      this.cleanupFn = null;
      await this.runCleanup(staleCleanup, "retry reset");
      if (generation !== this.loadGeneration) return;
    }

    AppLoadManager.block(EARTH_LOAD_KEY);
    this.watchForReadiness(generation, container);
    const loadAbortController = new AbortController();
    this.loadAbortController = loadAbortController;

    const loadPromise = (async () => {
      try {
        const { initThreeEarth } = await import("../three-earth-system.js?v=berlin-mitte-r2");
        if (generation !== this.loadGeneration) return;
        if (typeof initThreeEarth !== "function") {
          throw new Error("initThreeEarth not found in module exports");
        }

        const cleanup = await initThreeEarth(loadAbortController.signal);
        if (typeof cleanup !== "function") throw new Error("Earth initialization failed");

        const stale = generation !== this.loadGeneration;
        const unavailable = this.isTerminalUnavailable(container);
        if (stale || unavailable) {
          await this.runCleanup(cleanup, stale ? "stale initialization" : "unavailable system");
          if (stale) return;
          throw new Error(container.dataset.threeError || "Three.js Earth is unavailable");
        }

        this.cleanupFn = cleanup;
      } catch (error) {
        if (generation !== this.loadGeneration) return;
        this.cancelReadiness?.();
        AppLoadManager.unblock(EARTH_LOAD_KEY);
        log.warn("Three.js failed, using CSS fallback:", error);
        this.announce("CSS-Modus aktiv — 3D-Ansicht nicht verfügbar");
      }
    })();
    this.loadPromise = loadPromise;

    try {
      await loadPromise;
    } finally {
      if (this.loadPromise === loadPromise) this.loadPromise = null;
      if (this.loadAbortController === loadAbortController) this.loadAbortController = null;
      if (generation === this.loadGeneration) this.isLoading = false;
    }
  }

  watchForReadiness(generation, container) {
    this.cancelReadiness?.();
    let timeout = null;
    const onFirstFrame = event => {
      const eventContainerId = event.detail?.containerId;
      if (!eventContainerId || !container.id || eventContainerId === container.id) finish();
    };
    const cancel = () => {
      document.removeEventListener("three-first-frame", onFirstFrame);
      if (timeout !== null) this.timers.clearTimeout(timeout);
      timeout = null;
      if (this.cancelReadiness === cancel) {
        this.cancelReadiness = null;
      }
    };
    const finish = () => {
      if (generation !== this.loadGeneration) return;
      cancel();
      AppLoadManager.unblock(EARTH_LOAD_KEY);
      this.announce("Interaktive 3D-Erde geladen");
    };
    document.addEventListener("three-first-frame", onFirstFrame);
    timeout = this.timers.setTimeout(() => {
      timeout = null;
      if (generation !== this.loadGeneration) return;
      log.warn("Three.js Earth loading timeout, clearing readiness block");
      cancel();
      container.setAttribute("aria-busy", "false");
      delete container.dataset.earthLoading;
      AppLoadManager.unblock(EARTH_LOAD_KEY);
    }, EARTH_LOAD_TIMEOUT_MS);
    this.cancelReadiness = cancel;
  }

  isTerminalUnavailable(container) {
    return (
      !container.isConnected ||
      container.classList.contains("error") ||
      container.classList.contains("three-earth-unavailable") ||
      Boolean(container.dataset.threeError)
    );
  }

  async runCleanup(cleanupFn, reason) {
    try {
      await cleanupFn();
    } catch (error) {
      log.warn(`Cleanup failed after ${reason}:`, error);
    }
  }

  init() {
    const container = this.getContainer();
    if (!container) return;
    if (this.isLoading || this.cleanupFn || this.deferIdleHandle) return;
    document.addEventListener("three-earth:retry", this.onRetryRequest);

    this.deferIdleHandle = scheduleIdleTask(() => this.load(), {
      timeout: 100,
      fallbackDelay: 100,
    });
  }

  clearDeferredLoadHooks() {
    cancelIdleTask(this.deferIdleHandle);
    this.deferIdleHandle = null;
  }

  async cleanup() {
    if (this.cleanupPromise) return this.cleanupPromise;

    this.loadGeneration++;
    this.isLoading = false;
    this.loadAbortController?.abort();
    this.loadAbortController = null;
    this.cancelReadiness?.();
    this.timers.clearAll();
    this.clearDeferredLoadHooks();
    document.removeEventListener("three-earth:retry", this.onRetryRequest);
    AppLoadManager.unblock(EARTH_LOAD_KEY);

    const activeCleanup = this.cleanupFn;
    this.cleanupFn = null;

    const cleanupPromise = activeCleanup
      ? this.runCleanup(activeCleanup, "manager cleanup")
      : Promise.resolve();

    this.cleanupPromise = cleanupPromise;
    try {
      await cleanupPromise;
    } finally {
      if (this.cleanupPromise === cleanupPromise) this.cleanupPromise = null;
    }
  }

  announce(message) {
    try {
      globalThis.announce?.(message, { dedupe: true });
    } catch {
      return;
    }
  }
}
