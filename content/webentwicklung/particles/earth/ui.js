import { CONFIG } from './config.js';
import { createLogger } from '../../shared-utilities.js';

const log = createLogger('EarthUI');

export function showLoadingState(container, progress) {
  if (!container) return;

  container.classList.add('loading');
  const loadingElement = container.querySelector('.three-earth-loading');
  if (loadingElement) loadingElement.classList.remove('hidden');

  const progressBar = container.querySelector('.loading-progress-bar');
  const progressText = container.querySelector('.loading-progress-text');

  if (progressBar) progressBar.style.width = `${progress * 100}%`;
  if (progressText) progressText.textContent = `${Math.round(progress * 100)}%`;
}

export function hideLoadingState(container) {
  if (!container) return;

  container.classList.remove('loading');
  const loadingElement = container.querySelector('.three-earth-loading');
  if (loadingElement) loadingElement.classList.add('hidden');
}

export function showErrorState(container, error, retryCallback) {
  if (!container) return;

  container.classList.add('error');
  container.classList.remove('loading');

  const errorElement = container.querySelector('.three-earth-error');
  if (errorElement) {
    errorElement.classList.remove('hidden');
    const errorText = errorElement.querySelector('p');
    if (errorText) {
      const msg = error?.message || 'Unknown error';
      errorText.textContent = `WebGL Fehler: ${msg}`;
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
    this.element = document.createElement('div');
    this.element.className = 'three-earth-performance-overlay';
    parentContainer.appendChild(this.element);

    this.renderer = renderer;
    this.onQualityChange = onQualityChange;
    this.frame = 0;
    this.lastTime = performance.now();
    this.fps = 60;
    this.currentPixelRatio = CONFIG.PERFORMANCE.PIXEL_RATIO;
    this.currentQualityLevel = 'HIGH';
  }

  update() {
    this.frame++;
    const time = performance.now();
    if (time >= this.lastTime + 1000) {
      this.fps = (this.frame * 1000) / (time - this.lastTime);
      this.lastTime = time;
      this.frame = 0;
      this.updateDisplay();
      this.adjustResolution();
    }
  }

  updateDisplay() {
    if (!this.renderer) return;
    const render = this.renderer.info.render;
    this.element.innerHTML = `
      FPS: ${Math.round(this.fps)} |
      Calls: ${render.calls} | Tris: ${(render.triangles / 1000).toFixed(1)}k |
      PR: ${this.currentPixelRatio.toFixed(2)}
    `;
  }

  adjustResolution() {
    this.adjustQualityLevel();

    if (this.fps < 10) {
      this.currentPixelRatio = 0.5;
      this.renderer.setPixelRatio(this.currentPixelRatio);
      return;
    }

    if (this.fps < CONFIG.PERFORMANCE.DRS_DOWN_THRESHOLD && this.currentPixelRatio > 0.5) {
      this.currentPixelRatio = Math.max(0.5, this.currentPixelRatio - 0.15);
      this.renderer.setPixelRatio(this.currentPixelRatio);
    } else if (
      this.fps > CONFIG.PERFORMANCE.DRS_UP_THRESHOLD &&
      this.currentPixelRatio < CONFIG.PERFORMANCE.PIXEL_RATIO
    ) {
      this.currentPixelRatio = Math.min(
        CONFIG.PERFORMANCE.PIXEL_RATIO,
        this.currentPixelRatio + 0.05
      );
      this.renderer.setPixelRatio(this.currentPixelRatio);
    }
  }

  adjustQualityLevel() {
    const prevLevel = this.currentQualityLevel;

    if (this.fps < CONFIG.QUALITY_LEVELS.MEDIUM.minFPS) {
      this.currentQualityLevel = 'LOW';
    } else if (this.fps < CONFIG.QUALITY_LEVELS.HIGH.minFPS) {
      this.currentQualityLevel = 'MEDIUM';
    } else {
      this.currentQualityLevel = 'HIGH';
    }

    if (prevLevel !== this.currentQualityLevel && this.onQualityChange) {
      this.onQualityChange(this.currentQualityLevel);
    }
  }

  cleanup() {
    this.element?.parentNode?.removeChild(this.element);
  }
}
