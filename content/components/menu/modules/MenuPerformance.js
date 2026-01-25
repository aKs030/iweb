/**
 * Menu Performance Utilities
 * Optimizations for better performance
 */

export class MenuPerformance {
  constructor() {
    this.metrics = new Map();
    this.observers = new Map();
  }

  // Debounce function
  debounce(fn, delay) {
    let timeoutId;
    return (...args) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn(...args), delay);
    };
  }

  // Throttle function
  throttle(fn, limit) {
    let inThrottle;
    return (...args) => {
      if (!inThrottle) {
        fn(...args);
        inThrottle = true;
        setTimeout(() => (inThrottle = false), limit);
      }
    };
  }

  // RAF-based animation
  animate(callback) {
    return requestAnimationFrame(callback);
  }

  // Batch DOM reads
  batchRead(reads) {
    return requestAnimationFrame(() => {
      return reads.map((read) => read());
    });
  }

  // Batch DOM writes
  batchWrite(writes) {
    return requestAnimationFrame(() => {
      writes.forEach((write) => write());
    });
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

  // Intersection Observer for lazy loading
  createIntersectionObserver(callback, options = {}) {
    const observer = new IntersectionObserver(callback, {
      rootMargin: '50px',
      threshold: 0.1,
      ...options,
    });
    return observer;
  }

  // Prefetch resources
  prefetch(url) {
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = url;
    document.head.appendChild(link);
  }

  // Preload critical resources
  preload(url, as = 'script') {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.href = url;
    link.as = as;
    document.head.appendChild(link);
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
    this.observers.forEach((observer) => observer.disconnect());
    this.observers.clear();
  }
}
