/**
 * Layout Performance Optimization Utilities
 * 
 * Reduziert Forced Reflows durch:
 * - Batching von Layout-Reads
 * - Caching von getBoundingClientRect() Ergebnissen
 * - requestAnimationFrame Scheduling
 * 
 * @module layout-optimizer
 */

/**
 * Layout Read/Write Batcher
 * Verhindert Layout Thrashing durch Trennung von Reads und Writes
 */
export class LayoutBatcher {
  constructor() {
    this.readQueue = [];
    this.writeQueue = [];
    this.scheduled = false;
  }

  /**
   * Plant eine Layout-Read-Operation (z.B. getBoundingClientRect)
   * @param {Function} readFn - Funktion die Layout-Informationen liest
   * @returns {Promise} Promise das mit dem Ergebnis resolved
   */
  read(readFn) {
    return new Promise((resolve) => {
      this.readQueue.push(() => {
        const result = readFn();
        resolve(result);
      });
      this.schedule();
    });
  }

  /**
   * Plant eine Layout-Write-Operation (z.B. style-Änderungen)
   * @param {Function} writeFn - Funktion die das Layout verändert
   */
  write(writeFn) {
    this.writeQueue.push(writeFn);
    this.schedule();
  }

  schedule() {
    if (this.scheduled) return;
    this.scheduled = true;

    requestAnimationFrame(() => {
      // Erst alle Reads ausführen
      const reads = this.readQueue.splice(0);
      reads.forEach(fn => fn());

      // Dann alle Writes ausführen
      const writes = this.writeQueue.splice(0);
      writes.forEach(fn => fn());

      this.scheduled = false;
    });
  }
}

/**
 * Rect Cache mit automatischer Invalidierung
 * Cached getBoundingClientRect() Ergebnisse für ein Frame
 */
export class RectCache {
  constructor() {
    this.cache = new WeakMap();
    this.frameId = null;
    this.currentFrame = 0;
  }

  /**
   * Holt das cached Rect oder berechnet es neu
   * @param {HTMLElement} element 
   * @returns {DOMRect}
   */
  get(element) {
    if (!element) return null;

    // Invalidiere Cache bei neuem Frame
    if (this.frameId === null) {
      this.scheduleInvalidation();
    }

    const cached = this.cache.get(element);
    if (cached && cached.frame === this.currentFrame) {
      return cached.rect;
    }

    // Berechne und cache
    const rect = element.getBoundingClientRect();
    this.cache.set(element, { rect, frame: this.currentFrame });
    return rect;
  }

  scheduleInvalidation() {
    this.frameId = requestAnimationFrame(() => {
      this.currentFrame++;
      this.frameId = null;
    });
  }

  clear() {
    this.cache = new WeakMap();
  }
}

/**
 * Throttled Reflow-Checks
 * Reduziert die Frequenz von teuren Layout-Berechnungen
 */
export class ThrottledLayoutChecker {
  constructor(checkFn, interval = 30) {
    this.checkFn = checkFn;
    this.interval = interval;
    this.lastCheck = 0;
    this.scheduled = false;
  }

  check() {
    const now = performance.now();
    const timeSinceLastCheck = now - this.lastCheck;

    if (timeSinceLastCheck >= this.interval) {
      this.lastCheck = now;
      this.checkFn();
    } else if (!this.scheduled) {
      this.scheduled = true;
      const delay = this.interval - timeSinceLastCheck;
      
      setTimeout(() => {
        this.scheduled = false;
        this.lastCheck = performance.now();
        this.checkFn();
      }, delay);
    }
  }

  reset() {
    this.lastCheck = 0;
    this.scheduled = false;
  }
}

/**
 * Globale Instanzen für die gesamte App
 */
export const layoutBatcher = new LayoutBatcher();
export const rectCache = new RectCache();
