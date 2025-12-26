// Particle system configuration
// Export candidate paths for Three.js (local vendor copy first, then CDN fallback)
export const THREE_VERSION = '0.155.0'
// Prefer a local vendor copy (if present) to avoid expanding CSP for CDNs. If not present, fallback to CDN.
export const THREE_PATHS = [
  '/content/vendor/three/three.module.js',
  `https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/build/three.module.js`
]

// Future config keys can be exported from here (e.g., PERFORMANCE flags)
