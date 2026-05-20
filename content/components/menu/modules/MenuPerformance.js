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

  // Cleanup
  destroy() {
    this.metrics.clear();
  }
}
