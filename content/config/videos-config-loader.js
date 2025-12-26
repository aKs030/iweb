/*
  videos-config-loader.js

  Client-side loader that assembles the YouTube API key from two separately provided parts.
  Usage:
    - Copy videos-part-a.example.js -> videos-part-a.js
    - Copy videos-part-b.example.js -> videos-part-b.js
    - Replace the placeholder strings with Base64-encoded fragments of your API key (e.g. btoa('fragment')).

  Notes:
    - These part files MUST be gitignored (they are by default in .gitignore after the change).
    - This is obfuscation only and does NOT secure the key from determined attackers.
*/

async function loadConfig() {
  let log
  try {
    const {createLogger} = await import('../utils/shared-utilities.js')
    log = createLogger('VideosConfig')
    let partA = ''
    let partB = ''

    try {
      const m = await import('./videos-part-a.js')
      partA = m && (m.default || '')
    } catch (err) {
      log.warn('VideosConfig: videos-part-a import failed', err)
      // missing or not found - skip
    }

    try {
      const m = await import('./videos-part-b.js')
      partB = m && (m.default || '')
    } catch (err) {
      log.warn('VideosConfig: videos-part-b import failed', err)
      // missing or not found - skip
    }

    const safeAtob = s => {
      try {
        return s ? atob(String(s)) : ''
      } catch (err) {
        // If it's not base64, return raw
        log.warn('VideosConfig: safeAtob failed', err)
        return String(s || '')
      }
    }

    const key = safeAtob(partA) + safeAtob(partB)
    if (key) {
      window.YOUTUBE_API_KEY = key
    }

    if (!window.YOUTUBE_CHANNEL_HANDLE) {
      window.YOUTUBE_CHANNEL_HANDLE = 'aks.030'
    }

    // If no API key found, enable mock mode for stable local testing (localhost or file:).
    // Also allow forcing mock mode via ?mockVideos=1
    if (!window.YOUTUBE_API_KEY) {
      const isLocal = location.protocol === 'file:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1'
      if (isLocal || new URLSearchParams(location.search).has('mockVideos')) {
        window.YOUTUBE_USE_MOCK = true
        log.warn('No API key found — using mock data for development/testing.')
      } else {
        window.YOUTUBE_USE_MOCK = false
      }
    } else {
      window.YOUTUBE_USE_MOCK = false
    }
  } catch (e) {
    // Non-fatal — videos.js will handle absence of key gracefully
    // use console as fallback when `log` isn't available
    if (typeof log !== 'undefined' && typeof log.warn === 'function') log.warn('[videos-config-loader] Could not load split parts:', e)
    else console.warn('[videos-config-loader] Could not load split parts:', e)
  }
}

loadConfig()

export default true
