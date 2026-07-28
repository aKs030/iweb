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

const log = createLogger("EarthUI");

/*
  Earth loading UI
  - Publishes loading progress through AppLoadManager events.
  - Maintains aria-busy state on the Earth container.
  - Stays independent from route-specific loader DOM.
*/

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
}

export function showErrorState(container, error, retryCallback) {
  if (!container) return;

  container.setAttribute("aria-busy", "false");
  delete container.dataset.earthLoading;

  container.classList.add("error");

  const errorElement = container.querySelector(".three-earth-error");
  if (errorElement) {
    errorElement.classList.remove("hidden");
    // Keep the error element minimal—just a subtle indicator "CSS-Modus"
    // No verbose error message, just a silent fallback to static/CSS background
    const errorText = errorElement.querySelector("p");
    if (errorText) {
      // Simple indicator only, no "WebGL nicht verfügbar" text
      errorText.textContent = "CSS-Modus";
    }

    // Add retry button if not present
    let retryBtn = errorElement.querySelector(".three-earth-retry");
    if (!retryBtn && retryCallback) {
      retryBtn = document.createElement("button");
      retryBtn.className = "retry-btn three-earth-retry";
      retryBtn.type = "button";
      retryBtn.textContent = "Neu versuchen";
      retryBtn.addEventListener("click", async () => {
        try {
          await retryCallback();
        } catch (err) {
          log.error("Retry failed:", err);
          if (errorText) errorText.textContent = `Fehler: ${err.message}`;
        }
      });
      errorElement.appendChild(retryBtn);
    }
  }
}

export class PerformanceMonitor {
  constructor(onQualityChange, initialQualityLevel = "HIGH") {
    this.onQualityChange = onQualityChange;
    this.frame = 0;
    this.lastTime = performance.now();
    this.fps = 60;
    this.currentQualityLevel = initialQualityLevel;
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
    const newQualityLevel = calculateQualityLevel(this.fps, this.currentQualityLevel);
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
    const qualityOrder = { LOW: 0, MEDIUM: 1, HIGH: 2 };
    const isUpgrade = qualityOrder[newQualityLevel] > qualityOrder[this.currentQualityLevel];
    const requiredSamples = isUpgrade ? 3 : 2;
    if (this.pendingSamples < requiredSamples) return;

    this.currentQualityLevel = newQualityLevel;
    this.pendingSamples = 0;
    if (this.onQualityChange) this.onQualityChange(this.currentQualityLevel);
  }

  restoreQuality(qualityLevel) {
    this.currentQualityLevel = qualityLevel;
    this.pendingQualityLevel = qualityLevel;
    this.pendingSamples = 0;
    this.frame = 0;
    this.lastTime = performance.now();
    if (this.onQualityChange) this.onQualityChange(qualityLevel);
  }
}
