/**
 * Shared Particle System - Optimized Common Infrastructure
 * * OPTIMIZATIONS v2.2.0:
 * - ShootingStarManager moved to `three-earth-system.js`
 * - Simplified state management
 * - Improved cleanup flow
 * - Better error handling
 * - Reduced memory footprint
 *
 * OPTIMIZATIONS v2.3.0:
 * - Prefer local Three.js vendor copy with CDN fallback; support precompressed assets
 * @version 2.4.0
 * @last-modified 2025-12-19
 */

import {createLogger, throttle} from '../../utils/shared-utilities.js'
import {THREE_PATHS} from './config.js'

const log = createLogger('sharedParticleSystem')

// ===== Shared Configuration =====

const SHARED_CONFIG = {
  PERFORMANCE: {
    THROTTLE_MS: 20
  },
  SCROLL: {
    CSS_PROPERTY_PREFIX: '--scroll-'
  }
}

// ===== Shared State Management =====

class SharedParticleState {
  constructor() {
    this.systems = new Map()
    this.isInitialized = false
  }

  registerSystem(name, instance) {
    if (this.systems.has(name)) {
      log.warn(`System '${name}' already registered, overwriting`)
    }
    this.systems.set(name, instance)
    log.debug(`System '${name}' registered`)
  }

  unregisterSystem(name) {
    const deleted = this.systems.delete(name)
    if (deleted) {
      log.debug(`System '${name}' unregistered`)
    }
    return deleted
  }

  hasSystem(name) {
    return this.systems.has(name)
  }

  reset() {
    this.systems.clear()
    this.isInitialized = false
    log.debug('State reset')
  }
}

const sharedState = new SharedParticleState()

// ===== Parallax Manager =====

class SharedParallaxManager {
  constructor() {
    this.isActive = false
    this.handlers = new Set()
    this.scrollHandler = null
  }

  addHandler(handler, name = 'anonymous') {
    if (typeof handler !== 'function') {
      log.error(`Invalid handler for '${name}', must be a function`)
      return
    }

    this.handlers.add({handler, name})
    log.debug(`Parallax handler '${name}' added`)

    if (!this.isActive) {
      this.activate()
    }
  }

  removeHandler(handler) {
    const handlerObj = Array.from(this.handlers).find(h => h.handler === handler)
    if (handlerObj) {
      this.handlers.delete(handlerObj)
      log.debug(`Parallax handler '${handlerObj.name}' removed`)
    }

    if (this.handlers.size === 0) {
      this.deactivate()
    }
  }

  activate() {
    if (this.isActive) return

    this.scrollHandler = throttle(() => {
      const scrollY = window.pageYOffset
      const windowHeight = window.innerHeight
      const documentHeight = document.documentElement.scrollHeight
      const scrollableHeight = Math.max(1, documentHeight - windowHeight)
      const progress = Math.min(1, Math.max(0, scrollY / scrollableHeight))

      // Update CSS variable
      document.documentElement.style.setProperty(`${SHARED_CONFIG.SCROLL.CSS_PROPERTY_PREFIX}progress`, progress.toFixed(4))

      // Call all handlers
      this.handlers.forEach(({handler, name}) => {
        try {
          handler(progress)
        } catch (error) {
          log.error(`Error in parallax handler '${name}':`, error)
        }
      })
    }, SHARED_CONFIG.PERFORMANCE.THROTTLE_MS)

    window.addEventListener('scroll', this.scrollHandler, {passive: true})
    this.isActive = true

    // Initial call
    this.scrollHandler()

    log.info('Parallax manager activated')
  }

  deactivate() {
    if (!this.isActive) return

    if (this.scrollHandler) {
      window.removeEventListener('scroll', this.scrollHandler)
      this.scrollHandler = null
    }

    this.isActive = false
    this.handlers.clear()

    log.info('Parallax manager deactivated')
  }
}

// ===== Cleanup Manager =====

class SharedCleanupManager {
  constructor() {
    this.cleanupFunctions = new Map()
  }

  addCleanupFunction(systemName, cleanupFn, description = 'anonymous') {
    if (typeof cleanupFn !== 'function') {
      log.error(`Invalid cleanup function for '${systemName}', must be a function`)
      return
    }

    if (!this.cleanupFunctions.has(systemName)) {
      this.cleanupFunctions.set(systemName, [])
    }

    this.cleanupFunctions.get(systemName).push({fn: cleanupFn, description})
    log.debug(`Cleanup function '${description}' registered for '${systemName}'`)
  }

  cleanupSystem(systemName) {
    const systemCleanups = this.cleanupFunctions.get(systemName)
    if (!systemCleanups || systemCleanups.length === 0) {
      log.debug(`No cleanup functions for system '${systemName}'`)
      return
    }

    log.info(`Cleaning up system '${systemName}' (${systemCleanups.length} functions)`)

    let successCount = 0
    let errorCount = 0

    systemCleanups.forEach(({fn, description}) => {
      try {
        fn()
        successCount++
      } catch (error) {
        errorCount++
        log.error(`Error in cleanup '${description}' for '${systemName}':`, error)
      }
    })

    this.cleanupFunctions.delete(systemName)

    log.info(`System '${systemName}' cleanup complete: ${successCount} success, ${errorCount} errors`)
  }

  cleanupAll() {
    log.info('Starting global cleanup of all systems')

    const systemNames = Array.from(this.cleanupFunctions.keys())
    systemNames.forEach(systemName => this.cleanupSystem(systemName))

    // Deactivate parallax
    sharedParallaxManager.deactivate()

    // Reset state
    sharedState.reset()

    log.info('Global cleanup completed')
  }

  hasSystem(systemName) {
    return this.cleanupFunctions.has(systemName)
  }

  getSystemCount() {
    return this.cleanupFunctions.size
  }
}

// ===== Singleton Instances =====

export const sharedParallaxManager = new SharedParallaxManager()
export const sharedCleanupManager = new SharedCleanupManager()

// ===== Shared Three.js Loading =====

// Exported list of candidates for Three.js module. Can be overridden in tests/builds.
// `THREE_PATHS` is imported from `config.js`

let threeLoadingPromise = null

export async function loadThreeJS() {
  // Return cached instance
  if (window.THREE?.WebGLRenderer) {
    log.info('✅ Three.js already loaded (cached)')
    return window.THREE
  }

  // Return existing loading promise to prevent duplicate loads
  if (threeLoadingPromise) {
    log.debug('Three.js load already in progress, waiting...')
    return threeLoadingPromise
  }

  threeLoadingPromise = (async () => {
    for (let i = 0; i < THREE_PATHS.length; i++) {
      const src = THREE_PATHS[i]
      try {
        log.info(`📦 Preparing to load Three.js from: ${src}`)

        // If this is a same-origin (local) path, do a quick HEAD check to verify availability
        // and inspect Content-Encoding (precompressed .br/.gz served by the host).
        const isLocalPath = src.startsWith('/') || src.startsWith(location.origin)
        if (isLocalPath) {
          try {
            const headResp = await fetch(src, {method: 'HEAD', cache: 'no-store'})
            if (!headResp.ok) {
              log.warn(`HEAD check for local Three.js returned ${headResp.status} - skipping ${src}`)
              // Skip to next candidate (likely CDN)
              if (i === THREE_PATHS.length - 1) {
                log.error('❌ Local Three.js missing and no further fallbacks')
                throw new Error('Local Three.js not available')
              }
              continue
            }

            const encoding = headResp.headers.get('content-encoding')
            if (encoding) {
              log.info(`Server serves precompressed Three.js at ${src} with Content-Encoding: ${encoding}`)
            } else {
              log.info(`No Content-Encoding header for ${src}; server may serve uncompressed or use static precompressed mapping.`)
            }
          } catch (headErr) {
            log.debug('HEAD check failed for local Three.js; will attempt import and fallback if needed', headErr)
          }
        } else {
          // For cross-origin candidates a HEAD check may be blocked by CORS; attempt HEAD but don't fail on error
          try {
            const headResp = await fetch(src, {method: 'HEAD', mode: 'cors', cache: 'no-store'})
            if (headResp && headResp.ok) {
              const encoding = headResp.headers.get('content-encoding')
              if (encoding) log.info(`Remote precompressed Content-Encoding for ${src}: ${encoding}`)
            }
          } catch (e) {
            log.debug('HEAD check for cross-origin resource failed or blocked by CORS; proceeding to import', e)
          }
        }

        // Now attempt dynamic import
        log.info(`📦 Loading Three.js from: ${src}`)
        // Use dynamic import; in browsers, local paths should be absolute or relative to origin.
        const THREE = await import(src)
        const ThreeJS = THREE.default || THREE

        if (!ThreeJS?.WebGLRenderer) {
          throw new Error('Invalid Three.js module - missing WebGLRenderer')
        }

        window.THREE = ThreeJS
        log.info('✅ Three.js loaded successfully')
        return ThreeJS
      } catch (error) {
        log.warn(`Failed to load Three.js from ${src}:`, error.message)

        // If last attempt, throw error
        if (i === THREE_PATHS.length - 1) {
          log.error('❌ Failed to load Three.js from all sources')
          throw new Error('Three.js could not be loaded from any source')
        }
      }
    }
  })()

  try {
    return await threeLoadingPromise
  } finally {
    threeLoadingPromise = null
  }
}

// ===== Public API =====

export function getSharedState() {
  return sharedState
}

export function registerParticleSystem(name, instance) {
  sharedState.registerSystem(name, instance)
}

export function unregisterParticleSystem(name) {
  return sharedState.unregisterSystem(name)
}

// Deprecated: hasParticleSystem was used to query shared particle systems.
// Prefer using `getSharedState().hasSystem(name)` directly for explicit access.
// Kept for backward-compatibility until v2.4, but removed here as it's unused.

// ===== Global Cleanup Hook =====

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    sharedCleanupManager.cleanupAll()
  })
}
