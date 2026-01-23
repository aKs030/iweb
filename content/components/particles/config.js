// Particle system configuration
// Three.js loaded from CDN
const THREE_VERSION = '0.155.0';
export const THREE_PATHS = [
  `https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/build/three.module.js`,
];

// Performance configuration
export const PERFORMANCE_CONFIG = {
  enableParticles: true,
  maxParticles: 1000,
  enableAnimations: true,
};

// Scroll configuration
export const SCROLL_CONFIG = {
  enableScrollEffects: true,
  scrollThreshold: 0.1,
};

// Future config keys can be exported from here (e.g., PERFORMANCE flags)
