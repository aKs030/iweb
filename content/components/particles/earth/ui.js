import { CONFIG } from './config.js';
import { createLogger, throttle } from '/content/utils/shared-utilities.js';
import {
  calculateQualityLevel,
  calculateDynamicResolution,
} from './ui_helpers.js';

const log = createLogger('EarthUI');

/*
  Earth UI Loader
  - Uses the global page loader (id: #app-loader) with neon progress UI.
  - This module only toggles visibility and can hint a status message while
    the Earth system spins up.
*/

function getGlobalLoaderElements() {
  const overlay = document.getElementById('app-loader');
  const text = document.getElementById('loader-status-text');
  if (!overlay) return null;
  return { overlay, text };
}

export function showLoadingState(container, progress) {
  if (!container) return;

  // Prefer the global page loader when available
  const globals = getGlobalLoaderElements();
  if (globals?.overlay) {
    if (globals.overlay.dataset.loaderDone === 'true') return;

    globals.overlay.classList.remove('fade-out', 'hidden');
    globals.overlay.removeAttribute('aria-hidden');
    globals.overlay.setAttribute('aria-live', 'polite');
    globals.overlay.setAttribute('role', 'status');
    Object.assign(globals.overlay.style, {
      display: 'flex',
      opacity: '1',
      pointerEvents: 'auto',
      visibility: 'visible',
    });

    if (globals.text) {
      if (typeof progress === 'number') {
        const pct = Math.round(progress * 100);
        globals.text.textContent = `Lädt 3D‑Ansicht… (${pct}%)`;
      } else {
        globals.text.textContent = 'Initialisiere 3D-Engine...';
      }
    }

    if (typeof progress === 'number') {
      globals.overlay.setAttribute(
        'aria-valuenow',
        String(Math.round(progress * 100)),
      );
      globals.overlay.setAttribute('aria-valuemin', '0');
      globals.overlay.setAttribute('aria-valuemax', '100');
    } else {
      globals.overlay.removeAttribute('aria-valuenow');
      globals.overlay.removeAttribute('aria-valuemin');
      globals.overlay.removeAttribute('aria-valuemax');
    }

    try {
      document.body.classList.add('global-loading-visible');
    } catch (err) {
      log.warn('EarthUI: add global-loading-visible failed', err);
    }
  } else {
    // Fallback: no local progress UI; do nothing.
  }
}

export function hideLoadingState(container) {
  if (!container) return;

  const globals = getGlobalLoaderElements();
  if (globals?.overlay) {
    globals.overlay.classList.add('fade-out');
    globals.overlay.setAttribute('aria-hidden', 'true');
    globals.overlay.removeAttribute('aria-live');

    setTimeout(() => {
      if (globals.overlay) globals.overlay.style.display = 'none';
      try {
        document.body.classList.remove('global-loading-visible');
      } catch (err) {
        log.warn('EarthUI: remove global-loading-visible failed', err);
      }
    }, 800);
  } else {
    // No local progress UI to clear; do nothing.
  }
}

export function showErrorState(container, error, retryCallback) {
  if (!container) return;

  // Hide global loader to reveal page error/fallback
  const globals = getGlobalLoaderElements();
  if (globals?.overlay) {
    globals.overlay.classList.add('fade-out');
    // Ensure loader fully hides
    hideLoadingState(container);
  }

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
      container.style.backgroundImage = 'url(/content/assets/img/earth/earth_day.webp)';
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
      1000,
    );
  }

  update() {
    this.frame++;
    const time = performance.now();
    if (time >= this.lastTime + 1000) {
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
