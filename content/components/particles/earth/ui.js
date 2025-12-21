import {CONFIG} from './config.js'
import {createLogger, throttle} from '../../../utils/shared-utilities.js'
import {calculateQualityLevel, calculateDynamicResolution} from './ui_helpers.js'

const log = createLogger('EarthUI')

/*
  Earth UI Loader
  - Optimized to delegate global loading state to AppLoadManager/LoadingScreenManager.
  - This module now only handles local container states (like errors).
*/

// No-op for global loader manipulation as it's handled centrally now.
export function showLoadingState(_container) {
  // Logic handled by AppLoadManager.block() in parent system
}

export function hideLoadingState(_container) {
  // Logic handled by AppLoadManager.unblock() in parent system
}

export function showErrorState(container, error, retryCallback) {
  if (!container) return

  // Global loader is hidden by unblocking in the parent system.

  container.classList.add('error')

  const errorElement = container.querySelector('.three-earth-error')
  if (errorElement) {
    errorElement.classList.remove('hidden')
    const errorText = errorElement.querySelector('p')
    if (errorText) {
      const msg = error?.message || 'Unknown error'
      errorText.textContent = `WebGL Fehler: ${msg}`
    }

    // Add retry button if not present
    let retryBtn = errorElement.querySelector('.three-earth-retry')
    if (!retryBtn && retryCallback) {
      retryBtn = document.createElement('button')
      retryBtn.className = 'retry-btn three-earth-retry'
      retryBtn.type = 'button'
      retryBtn.textContent = 'Neu versuchen'
      retryBtn.addEventListener('click', async () => {
        try {
          await retryCallback()
        } catch (err) {
          log.error('Retry failed:', err)
          if (errorText) errorText.textContent = `Fehler: ${err.message}`
        }
      })
      errorElement.appendChild(retryBtn)
    }
  }
}

export class PerformanceMonitor {
  constructor(parentContainer, renderer, onQualityChange) {
    this.renderer = renderer
    this.onQualityChange = onQualityChange
    this.frame = 0
    this.lastTime = performance.now()
    this.fps = 60
    this.currentPixelRatio = CONFIG.PERFORMANCE.PIXEL_RATIO
    this.currentQualityLevel = 'HIGH'

    // Throttled adjustment to avoid rapid fluctuating changes
    this.throttledAdjustResolution = throttle(() => this.adjustResolution(), 1000)
  }

  update() {
    this.frame++
    const time = performance.now()
    if (time >= this.lastTime + 1000) {
      this.fps = (this.frame * 1000) / (time - this.lastTime)
      this.lastTime = time
      this.frame = 0
      this.throttledAdjustResolution()
    }
  }

  adjustResolution() {
    // 1. Quality Level Logic
    const newQualityLevel = calculateQualityLevel(this.fps)
    if (newQualityLevel !== this.currentQualityLevel) {
      this.currentQualityLevel = newQualityLevel
      if (this.onQualityChange) this.onQualityChange(this.currentQualityLevel)
    }

    // 2. Pixel Ratio Logic
    const newPixelRatio = calculateDynamicResolution(this.fps, this.currentPixelRatio, CONFIG.PERFORMANCE)

    if (newPixelRatio !== this.currentPixelRatio) {
      this.currentPixelRatio = newPixelRatio
      this.renderer.setPixelRatio(this.currentPixelRatio)
    }
  }

  cleanup() {
    // Nothing to clean up since overlay was removed
  }
}
