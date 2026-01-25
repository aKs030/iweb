/**
 * Simple Loading Screen Manager
 * @version 2.0.0
 */

import {
  createLogger,
  getElementById,
  EVENTS,
  fire,
} from './shared-utilities.js';

const log = createLogger('LoaderManager');

export class LoaderManager {
  constructor() {
    this.overlay = null;
    this.hasHidden = false;
    this.startTime = 0;
  }

  init() {
    this.startTime = performance.now();
    this.overlay = getElementById('app-loader');

    if (!this.overlay) return;

    this.overlay.classList.remove('fade-out');
    this.overlay.style.display = 'flex';
    this.overlay.removeAttribute('aria-hidden');

    try {
      document.body.classList.add('global-loading-visible');
    } catch {
      /* ignore */
    }
  }

  hide() {
    if (this.hasHidden || !this.overlay) return;

    const elapsed = performance.now() - this.startTime;
    const minDelay = Math.max(0, 500 - elapsed);

    setTimeout(() => {
      if (this.hasHidden) return;
      this.hasHidden = true;

      this.overlay.classList.add('fade-out');
      this.overlay.setAttribute('aria-hidden', 'true');
      this.overlay.dataset.loaderDone = 'true';

      const cleanup = () => {
        this.overlay.style.display = 'none';
        this.overlay.removeEventListener('transitionend', cleanup);
      };

      this.overlay.addEventListener('transitionend', cleanup);
      setTimeout(cleanup, 900);

      try {
        document.body.classList.remove('global-loading-visible');
      } catch {
        /* ignore */
      }

      fire(EVENTS.LOADING_HIDE);
      globalThis.dispatchEvent(new Event('app-ready'));
      log.info('Loading screen hidden');
    }, minDelay);
  }

  // Backward compatibility
  setStatus() {}
}
