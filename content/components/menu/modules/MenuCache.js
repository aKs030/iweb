/**
 * Menu Cache System
 * Efficient caching for DOM elements and computed values
 */

export class MenuCache {
  constructor() {
    this.elements = new Map();
    this.computed = new Map();
    this.timestamps = new Map();
    this.ttl = 5000; // 5 seconds default TTL
  }

  // Cache DOM element
  setElement(key, element) {
    this.elements.set(key, element);
    this.timestamps.set(key, Date.now());
  }

  // Get cached DOM element
  getElement(key) {
    return this.elements.get(key);
  }

  // Cache computed value with TTL
  setComputed(key, value, ttl = this.ttl) {
    this.computed.set(key, value);
    this.timestamps.set(key, Date.now());
    
    // Auto-expire
    if (ttl > 0) {
      setTimeout(() => {
        if (this.isExpired(key, ttl)) {
          this.computed.delete(key);
          this.timestamps.delete(key);
        }
      }, ttl);
    }
  }

  // Get cached computed value
  getComputed(key) {
    return this.computed.get(key);
  }

  // Check if cache entry is expired
  isExpired(key, ttl = this.ttl) {
    const timestamp = this.timestamps.get(key);
    if (!timestamp) return true;
    return Date.now() - timestamp > ttl;
  }

  // Get or compute
  getOrCompute(key, computeFn, ttl = this.ttl) {
    if (this.computed.has(key) && !this.isExpired(key, ttl)) {
      return this.computed.get(key);
    }
    
    const value = computeFn();
    this.setComputed(key, value, ttl);
    return value;
  }

  // Invalidate cache entry
  invalidate(key) {
    this.elements.delete(key);
    this.computed.delete(key);
    this.timestamps.delete(key);
  }

  // Clear all cache
  clear() {
    this.elements.clear();
    this.computed.clear();
    this.timestamps.clear();
  }

  // Get cache stats
  getStats() {
    return {
      elements: this.elements.size,
      computed: this.computed.size,
      total: this.elements.size + this.computed.size,
    };
  }
}
