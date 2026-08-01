import { CONFIG } from "./config.js";
import { createLogger } from "../../../core/logger.js";
import { AppLoadManager } from "../../../core/load-manager.js";
import { i18n } from "../../../core/i18n.js";

// ===== Helper Functions (Pure) =====

function calculateQualityLevel(fps, currentQualityLevel) {
  const highThreshold = CONFIG.QUALITY_LEVELS.HIGH.minFPS;
  const mediumThreshold = CONFIG.QUALITY_LEVELS.MEDIUM.minFPS;

  if (currentQualityLevel === "HIGH") {
    if (fps < mediumThreshold) return "LOW";
    return fps < highThreshold - 5 ? "MEDIUM" : "HIGH";
  }
  if (currentQualityLevel === "MEDIUM") {
    if (fps >= highThreshold + 5) return "HIGH";
    return fps < mediumThreshold - 3 ? "LOW" : "MEDIUM";
  }
  return fps >= mediumThreshold + 5 ? "MEDIUM" : "LOW";
}

const QUALITY_ORDER = Object.freeze({ LOW: 0, MEDIUM: 1, HIGH: 2 });

function clampQualityLevel(qualityLevel, maximumQualityLevel) {
  return QUALITY_ORDER[qualityLevel] <= QUALITY_ORDER[maximumQualityLevel]
    ? qualityLevel
    : maximumQualityLevel;
}

const log = createLogger("EarthUI");

function removeRetryButton(errorElement) {
  const retryButton = errorElement?.querySelector(".three-earth-retry");
  if (!retryButton) return;
  retryButton.onclick = null;
  retryButton.remove();
}

export function showLoadingState(container, progress) {
  if (!container) return;

  if (typeof progress === "number") {
    const pct = Math.round(progress * 100);
    AppLoadManager.updateLoader(
      progress,
      i18n.t("loader.loading_3d", /** @type {any} */ ({ pct }))
    );
  } else {
    AppLoadManager.updateLoader(0, i18n.t("loader.init_3d_engine"));
  }

  container.setAttribute("aria-busy", "true");
  container.dataset.earthLoading = "1";
}

export function hideLoadingState(container) {
  if (!container) return;

  container.setAttribute("aria-busy", "false");
  delete container.dataset.earthLoading;
  removeRetryButton(container.querySelector(".three-earth-error"));
}

export function showErrorState(container, error, retryCallback) {
  if (!container) return;

  container.setAttribute("aria-busy", "false");
  delete container.dataset.earthLoading;

  container.classList.add("error");

  const errorElement = container.querySelector(".three-earth-error");
  if (errorElement) {
    errorElement.classList.remove("hidden");
    const errorText = errorElement.querySelector("p");
    if (errorText) errorText.textContent = "CSS-Modus";

    let retryBtn = errorElement.querySelector(".three-earth-retry");
    if (!retryCallback) {
      removeRetryButton(errorElement);
      return;
    }
    if (!retryBtn) {
      retryBtn = document.createElement("button");
      retryBtn.className = "retry-btn three-earth-retry";
      retryBtn.type = "button";
      retryBtn.textContent = "Neu versuchen";
      errorElement.appendChild(retryBtn);
    }

    retryBtn.disabled = false;
    retryBtn.onclick = async () => {
      retryBtn.disabled = true;
      try {
        await retryCallback();
      } catch (err) {
        log.error("Retry failed:", err);
        const message = err instanceof Error ? err.message : String(err);
        if (errorText) errorText.textContent = `Fehler: ${message}`;
      } finally {
        if (retryBtn.isConnected) retryBtn.disabled = false;
      }
    };
  }
}

export class PerformanceMonitor {
  constructor(
    onQualityChange,
    initialQualityLevel = "HIGH",
    maximumQualityLevel = initialQualityLevel
  ) {
    this.onQualityChange = onQualityChange;
    this.frame = 0;
    this.lastTime = performance.now();
    this.fps = 60;
    this.currentQualityLevel = initialQualityLevel;
    this.maximumQualityLevel = maximumQualityLevel;
    this.pendingQualityLevel = initialQualityLevel;
    this.pendingSamples = 0;
  }

  update() {
    this.frame++;
    const time = performance.now();
    // Check every 2 seconds to stabilize readings and avoid ping-pong
    if (time >= this.lastTime + 2000) {
      this.fps = (this.frame * 1000) / (time - this.lastTime);
      this.lastTime = time;
      this.frame = 0;
      this.adjustQuality();
    }
  }

  adjustQuality() {
    const newQualityLevel = clampQualityLevel(
      calculateQualityLevel(this.fps, this.currentQualityLevel),
      this.maximumQualityLevel
    );
    if (newQualityLevel === this.currentQualityLevel) {
      this.pendingQualityLevel = newQualityLevel;
      this.pendingSamples = 0;
      return;
    }

    if (newQualityLevel !== this.pendingQualityLevel) {
      this.pendingQualityLevel = newQualityLevel;
      this.pendingSamples = 1;
      return;
    }

    this.pendingSamples++;
    const isUpgrade = QUALITY_ORDER[newQualityLevel] > QUALITY_ORDER[this.currentQualityLevel];
    const requiredSamples = isUpgrade ? 3 : 2;
    if (this.pendingSamples < requiredSamples) return;

    this.currentQualityLevel = newQualityLevel;
    this.pendingSamples = 0;
    if (this.onQualityChange) this.onQualityChange(this.currentQualityLevel);
  }
}
