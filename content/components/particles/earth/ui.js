import {CONFIG} from './config.js'
import {createLogger, throttle} from '../../../utils/shared-utilities.js'
import {calculateQualityLevel, calculateDynamicResolution} from './ui_helpers.js'

const log = createLogger('EarthUI')

/* Loading screen removed — functions are now no-ops for compatibility */

export function showLoadingState(container) {
  if (!container) return
  // No global loading screen available — this function intentionally does nothing.
}

export function hideLoadingState(container) {
  if (!container) return
  // No global loading screen available — this function intentionally does nothing.
}

export function showErrorState(container, error, retryCallback) {
  if (!container) return

  // Mark the container as errored and record a short message for debugging or external UI
  container.classList.add('error')
  const msg = error?.message || 'WebGL Fehler'
  try {
    // Keep a non-visual diagnostic on the DOM for other scripts to consume if needed
    container.dataset.threeEarthError = msg
    log.warn('ThreeEarth error:', msg)
  } catch (e) {
    /* ignore */
  }

  // The component no longer injects fallback DOM UI. If a retry is desired, callers may
  // register their own UI and call `retryCallback()` as needed.
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
