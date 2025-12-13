import {CONFIG} from './config.js'
import {createLogger, throttle} from '../../../utils/shared-utilities.js'
import {calculateQualityLevel, calculateDynamicResolution} from './ui_helpers.js'

const log = createLogger('EarthUI')

/*
  Earth UI Loader
  - Uses a single global page loader (id: #loadingScreen) with a spinner.
  - This module only shows/hides the spinner; progress bars/percent indicators
    were removed for a simpler, unified loading UX.
*/

function getGlobalLoaderElements() {
  const screen = document.getElementById('loadingScreen')
  if (!screen) return null
  return {screen}
}

export function showLoadingState(container) {
  if (!container) return

  // Prefer the global page loader when available
  const globals = getGlobalLoaderElements()
  if (globals && globals.screen) {
    globals.screen.classList.remove('hidden')
    globals.screen.classList.remove('hide')
    globals.screen.removeAttribute('aria-hidden')
    Object.assign(globals.screen.style, {
      display: 'flex',
      opacity: '1',
      pointerEvents: 'auto',
      visibility: 'visible'
    })
    // Optionally set an aria message
    globals.screen.setAttribute('aria-live', 'polite')
  } else {
    // Fallback: no local progress UI; do nothing.
  }
}

export function hideLoadingState(container) {
  if (!container) return

  const globals = getGlobalLoaderElements()
  if (globals && globals.screen) {
    // Hide the global loader using the same pattern as the rest of the app
    globals.screen.classList.add('hide')
    globals.screen.setAttribute('aria-hidden', 'true')
    globals.screen.removeAttribute('aria-live')
    Object.assign(globals.screen.style, {
      opacity: '0',
      pointerEvents: 'none',
      visibility: 'hidden'
    })
    // Reset visuals (after transition)
    setTimeout(() => {
      if (globals.screen) globals.screen.style.display = 'none'
    }, 300)
  } else {
    // No local progress UI to clear; do nothing.
  }
}

export function showErrorState(container, error, retryCallback) {
  if (!container) return

  // Hide global loader to reveal page error/fallback
  const globals = getGlobalLoaderElements()
  if (globals && globals.screen) {
    globals.screen.classList.add('hidden')
  }

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
    this.element = document.createElement('div')
    this.element.className = 'three-earth-performance-overlay'
    parentContainer.appendChild(this.element)

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
      this.updateDisplay()
      this.throttledAdjustResolution()
    }
  }

  updateDisplay() {
    if (!this.renderer) return
    const render = this.renderer.info.render
    this.element.innerHTML = `
      FPS: ${Math.round(this.fps)} |
      Calls: ${render.calls} | Tris: ${(render.triangles / 1000).toFixed(1)}k |
      PR: ${this.currentPixelRatio.toFixed(2)}
    `
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
    this.element?.parentNode?.removeChild(this.element)
  }
}
