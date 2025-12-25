// Particle system configuration
// Export candidate paths for Three.js (local vendor copy first, then CDN fallback)
export const THREE_VERSION = '0.155.0'
// Use CDN-only strategy: local vendor copy removed during cleanup.
export const THREE_PATHS = [`https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/build/three.module.js`]

// Future config keys can be exported from here (e.g., PERFORMANCE flags)
