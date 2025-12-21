/*
  Central LoadingScreen utility
  - Exposes: requestShow(id), release(id), forceHide(), init()
  - Uses a Set to track owners and enforces a MIN_DISPLAY_TIME
  - Idempotent and safe to call from multiple modules.
*/
const MIN_DISPLAY_TIME = 600
const TRANSITION_CLEANUP_MS = 700

const owners = new Set()
let startTime = 0
let cleanupScheduled = false
let hideTimeout = null
let element = null

function ensureElement() {
  if (element) return element
  element = document.getElementById('loadingScreen')
  if (!element) {
    // Create minimal loader if not present
    const wrapper = document.createElement('div')
    wrapper.id = 'loadingScreen'
    wrapper.className = 'loading-screen'
    wrapper.setAttribute('aria-hidden', 'true')
    wrapper.setAttribute('aria-label', 'Seite wird geladen')
    wrapper.setAttribute('role', 'status')
    wrapper.setAttribute('aria-live', 'polite')

    const spinner = document.createElement('div')
    spinner.className = 'loader'
    spinner.setAttribute('aria-hidden', 'true')

    wrapper.appendChild(spinner)

    if (document.body) {
      document.body.prepend(wrapper)
    } else {
      document.addEventListener('DOMContentLoaded', () => document.body.prepend(wrapper), {once: true})
    }
    createdByScript = true
    element = wrapper
  }
  return element
}

function showImmediate() {
  const el = ensureElement()
  if (!el) return
  el.classList.remove('hide')
  el.classList.remove('hidden')
  el.removeAttribute('aria-hidden')
  Object.assign(el.style, {
    display: 'flex',
    opacity: '1',
    pointerEvents: 'auto',
    visibility: 'visible'
  })
  try {
    document.body.classList.add('global-loading-visible')
  } catch {
    /* ignore */
  }
  startTime = performance.now()
}

function scheduleHide(delay = 0) {
  if (hideTimeout) clearTimeout(hideTimeout)
  hideTimeout = setTimeout(() => {
    const el = element || document.getElementById('loadingScreen')
    if (!el) return
    el.classList.add('hide')
    el.setAttribute('aria-hidden', 'true')
    el.removeAttribute('aria-live')
    Object.assign(el.style, {
      opacity: '0',
      pointerEvents: 'none',
      visibility: 'hidden'
    })

    // Ensure cleanup runs once after transition
    cleanupScheduled = true
    const cleanup = () => {
      if (!cleanupScheduled) return
      cleanupScheduled = false
      el.style.display = 'none'
      el.removeEventListener('transitionend', cleanup)
      if (hideTimeout) {
        clearTimeout(hideTimeout)
        hideTimeout = null
      }
      try {
        document.body.classList.remove('global-loading-visible')
      } catch {
        /* ignore */
      }
    }

    el.addEventListener('transitionend', cleanup)
    // Fallback in case transitionend isn't fired
    setTimeout(cleanup, TRANSITION_CLEANUP_MS)
  }, delay)
}

export const LoadingScreen = {
  init() {
    ensureElement()
  },

  requestShow(id = 'global') {
    if (!id) id = 'global'
    const wasVisible = owners.size > 0
    owners.add(id)
    // If first owner, show immediately
    if (!wasVisible) {
      showImmediate()
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
    // Immediate hide (no min display enforcement)
    if (hideTimeout) {
      clearTimeout(hideTimeout)
      hideTimeout = null
    }
    const el = element || document.getElementById('loadingScreen')
    if (!el) return
    el.classList.add('hide')
    el.setAttribute('aria-hidden', 'true')
    Object.assign(el.style, {
      opacity: '0',
      pointerEvents: 'none',
      visibility: 'hidden'
    })
    // Immediate cleanup
    setTimeout(() => {
      el.style.display = 'none'
      try {
        document.body.classList.remove('global-loading-visible')
      } catch {
        /* ignore */
      }
    }, 0)
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
