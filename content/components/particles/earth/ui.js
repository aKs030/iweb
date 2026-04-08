import { CONFIG } from './config.js';
import { createLogger } from '#core/logger.js';
import { throttle } from '#core/async-utils.js';
import { AppLoadManager } from '#core/load-manager.js';
import { i18n } from '#core/i18n.js';
import { EARTH_FALLBACK_BACKGROUND_URL } from './texture-paths.js';

import {
  calculateQualityLevel,
  calculateDynamicResolution,
} from './ui_helpers.js';

const log = createLogger('EarthUI');

/*
  Earth loading UI
  - Publishes loading progress through AppLoadManager events.
  - Maintains aria-busy state on the Earth container.
  - Stays independent from route-specific loader DOM.
*/

export function showLoadingState(container, progress) {
  if (!container) return;

  if (typeof progress === 'number') {
    const pct = Math.round(progress * 100);
    AppLoadManager.updateLoader(
      progress,
      i18n.t('loader.loading_3d', /** @type {any} */ ({ pct })),
    );
  } else {
    AppLoadManager.updateLoader(0, i18n.t('loader.init_3d_engine'));
  }

  container.setAttribute('aria-busy', 'true');
  container.dataset.earthLoading = '1';
}

export function hideLoadingState(container) {
  if (!container) return;

  container.setAttribute('aria-busy', 'false');
  delete container.dataset.earthLoading;
}

export function showErrorState(container, error, retryCallback) {
  if (!container) return;

  container.setAttribute('aria-busy', 'false');
  delete container.dataset.earthLoading;

  container.classList.add('error');

  const errorElement = container.querySelector('.three-earth-error');
  if (errorElement) {
    errorElement.classList.remove('hidden');
    // Keep the error element minimal—just a subtle indicator "CSS-Modus"
    // No verbose error message, just a silent fallback to static/CSS background
    const errorText = errorElement.querySelector('p');
    if (errorText) {
      // Simple indicator only, no "WebGL nicht verfügbar" text
      errorText.textContent = 'CSS-Modus';
    }

    // Optional: Add static Earth image background to container
    try {
      container.style.backgroundImage = `url(${EARTH_FALLBACK_BACKGROUND_URL})`;
      container.style.backgroundSize = 'cover';
      container.style.backgroundPosition = 'center';
      container.style.backgroundAttachment = 'fixed';
    } catch (err) {
      log.warn('Unable to set fallback background image', err);
    }

    // Add retry button if not present
    let retryBtn = errorElement.querySelector('.three-earth-retry');
    if (!retryBtn && retryCallback) {
      retryBtn = document.createElement('button');
      retryBtn.className = 'retry-btn three-earth-retry';
      retryBtn.type = 'button';
      retryBtn.textContent = 'Neu versuchen';
      retryBtn.addEventListener('click', async () => {
        try {
          await retryCallback();
        } catch (err) {
          log.error('Retry failed:', err);
          if (errorText) errorText.textContent = `Fehler: ${err.message}`;
        }
      });
      errorElement.appendChild(retryBtn);
    }
  }
}

export class PerformanceMonitor {
  constructor(parentContainer, renderer, onQualityChange) {
    this.renderer = renderer;
    this.onQualityChange = onQualityChange;
    this.frame = 0;
    this.lastTime = performance.now();
    this.fps = 60;
    this.currentPixelRatio = CONFIG.PERFORMANCE.PIXEL_RATIO;
    this.currentQualityLevel = 'HIGH';

    // Throttled adjustment to avoid rapid fluctuating changes
    this.throttledAdjustResolution = throttle(
      () => this.adjustResolution(),
      2000,
    );
  }

  update() {
    this.frame++;
    const time = performance.now();
    // Check every 2 seconds to stabilize readings and avoid ping-pong
    if (time >= this.lastTime + 2000) {
      this.fps = (this.frame * 1000) / (time - this.lastTime);
      this.lastTime = time;
      this.frame = 0;
      this.throttledAdjustResolution();
    }
  }

  adjustResolution() {
    // 1. Quality Level Logic
    const newQualityLevel = calculateQualityLevel(this.fps);
    if (newQualityLevel !== this.currentQualityLevel) {
      this.currentQualityLevel = newQualityLevel;
      if (this.onQualityChange) this.onQualityChange(this.currentQualityLevel);
    }

    // 2. Pixel Ratio Logic
    const newPixelRatio = calculateDynamicResolution(
      this.fps,
      this.currentPixelRatio,
      CONFIG.PERFORMANCE,
    );

    if (newPixelRatio !== this.currentPixelRatio) {
      log.info(
        `Adjusting pixel ratio: ${this.currentPixelRatio} -> ${newPixelRatio}`,
      );
      this.currentPixelRatio = newPixelRatio;
      try {
        this.renderer.setPixelRatio(this.currentPixelRatio);
      } catch (e) {
        log.warn('Failed to set pixel ratio on renderer:', e);
      }
    }
  }

  cleanup() {
    // Nothing to clean up since overlay was removed
  }
}
