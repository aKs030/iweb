/**
 * Menu Performance Utilities
 * Optimizations for better performance
 */

export class MenuPerformance {
  constructor() {
    this.metrics = new Map();
  }

  // Measure performance
  startMeasure(name) {
    this.metrics.set(name, performance.now());
  }

  endMeasure(name) {
    const start = this.metrics.get(name);
    if (start) {
      const duration = performance.now() - start;
      this.metrics.delete(name);
      return duration;
    }
    return 0;
  }

  // Check if reduced motion is preferred
  prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  // Get device capabilities
  getDeviceCapabilities() {
    return {
      isMobile: /iPhone|iPad|iPod|Android/i.test(navigator.userAgent),
      isTouch: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
      hasHover: window.matchMedia('(hover: hover)').matches,
      connection: navigator.connection?.effectiveType || 'unknown',
      memory: navigator.deviceMemory || 'unknown',
      cores: navigator.hardwareConcurrency || 'unknown',
    };
  }

  // Cleanup
  destroy() {
    this.metrics.clear();
  }
}
