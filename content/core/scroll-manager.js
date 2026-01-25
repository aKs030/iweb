/**
 * Scroll Manager
 * @version 1.0.0
 */

import { createLogger } from './shared-utilities.js';

const log = createLogger('ScrollManager');

export class ScrollManager {
  constructor() {
    this.snapTimer = null;
    this.snapContainer = null;
  }

  init(container = document.documentElement) {
    this.snapContainer = container;
    this.attachListeners();
    log.debug('Scroll manager initialized');
  }

  disableSnap() {
    this.snapContainer?.classList.add('no-snap');
  }

  enableSnap() {
    this.snapContainer?.classList.remove('no-snap');
  }

  handleScroll() {
    this.disableSnap();
    clearTimeout(this.snapTimer);
    this.snapTimer = setTimeout(() => this.enableSnap(), 150);
  }

  handleKey(event) {
    const scrollKeys = [
      'PageDown',
      'PageUp',
      'Home',
      'End',
      'ArrowDown',
      'ArrowUp',
      'Space',
    ];
    if (scrollKeys.includes(event.key)) {
      this.handleScroll();
    }
  }

  attachListeners() {
    globalThis.addEventListener('wheel', () => this.handleScroll(), {
      passive: true,
    });
    globalThis.addEventListener('touchmove', () => this.handleScroll(), {
      passive: true,
    });
    globalThis.addEventListener('keydown', (e) => this.handleKey(e), {
      passive: true,
    });
  }

  cleanup() {
    clearTimeout(this.snapTimer);
    this.snapTimer = null;
    log.debug('Scroll manager cleaned up');
  }
}
