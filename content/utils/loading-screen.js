/*
  Central LoadingScreen utility (Headless / Event-Driven)
  - Manages the state of "blocking" operations (owners).
  - Dispatches 'app-loaded' event when all owners release.
  - No longer manages its own DOM; the RobotCompanion acts as the visual loader.
*/
const MIN_DISPLAY_TIME = 600

const owners = new Set()
let startTime = 0
let hideTimeout = null

function dispatchLoadedEvent() {
  // Fire global event that the RobotCompanion (and others) can listen to
  window.dispatchEvent(new CustomEvent('app-loaded'))
  try {
    document.body.classList.remove('global-loading-visible')
  } catch {
    /* ignore */
  }
}

function scheduleHide(delay = 0) {
  if (hideTimeout) clearTimeout(hideTimeout)
  hideTimeout = setTimeout(() => {
    dispatchLoadedEvent()
    hideTimeout = null
  }, delay)
}

export const LoadingScreen = {
  init() {
    // No-op: Visuals are now static in HTML (Robot)
    startTime = performance.now()
  },

  requestShow(id = 'global') {
    if (!id) id = 'global'
    const wasVisible = owners.size > 0
    owners.add(id)
    if (!wasVisible) {
      startTime = performance.now()
      try {
        document.body.classList.add('global-loading-visible')
      } catch {
        /* ignore */
      }
    }
    return owners.size
  },

  release(id = 'global') {
    if (!id) id = 'global'
    if (!owners.has(id)) return owners.size
    owners.delete(id)
    if (owners.size === 0) {
      // enforce min display time
      const elapsed = performance.now() - (startTime || 0)
      const delay = Math.max(0, MIN_DISPLAY_TIME - elapsed)
      scheduleHide(delay)
    }
    return owners.size
  },

  forceHide() {
    owners.clear()
    if (hideTimeout) {
      clearTimeout(hideTimeout)
      hideTimeout = null
    }
    dispatchLoadedEvent()
  },

  getOwnerCount() {
    return owners.size
  }
}

// Expose on window for non-module contexts
if (typeof window !== 'undefined' && !window.LoadingScreen) {
  window.LoadingScreen = LoadingScreen
}

export default LoadingScreen
