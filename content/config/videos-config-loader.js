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
  try {
    let partA = ''
    let partB = ''

    try {
      const m = await import('./videos-part-a.js')
      partA = m && (m.default || '')
    } catch (e) {
      // missing or not found - skip
    }

    try {
      const m = await import('./videos-part-b.js')
      partB = m && (m.default || '')
    } catch (e) {
      // missing or not found - skip
    }

    const safeAtob = s => {
      try {
        return s ? atob(String(s)) : ''
      } catch (e) {
        // If it's not base64, return raw
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
  } catch (e) {
    // Non-fatal — videos.js will handle absence of key gracefully
    console.warn('[videos-config-loader] Could not load split parts:', e)
  }
}

loadConfig()

export default true
