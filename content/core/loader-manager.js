/**
 * Loading Screen Manager Module
 * Extracted from main.js for better maintainability
 * @version 1.0.0
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
    this.MIN_DISPLAY_TIME = 500;
    this.state = {
      overlay: null,
      bar: null,
      text: null,
      percent: null,
      progress: 0,
      interval: null,
      messageIndex: 0,
      messages: [
        'Initialisiere System...',
        'Assets werden geladen...',
        'Rendere 3D-Umgebung...',
        'Optimiere Performance...',
        'Starte Module...',
      ],
    };
    this.startTime = 0;
    this.hasHidden = false;
  }

  bindElements() {
    this.state.overlay = getElementById('app-loader');
    this.state.bar = getElementById('loader-progress-bar');
    this.state.text = getElementById('loader-status-text');
    this.state.percent = getElementById('loader-percentage');
    return Boolean(this.state.overlay);
  }

  updateUI(statusText) {
    if (this.state.bar) {
      this.state.bar.style.width = `${Math.floor(this.state.progress)}%`;
    }
    if (this.state.percent) {
      this.state.percent.textContent = `${Math.floor(this.state.progress)}%`;
    }
    if (statusText && this.state.text) {
      this.state.text.textContent = statusText;
    }
  }

  stopSimulation() {
    if (this.state.interval) {
      clearInterval(this.state.interval);
      this.state.interval = null;
    }
  }

  startSimulation() {
    if (!this.state.overlay) return;

    this.stopSimulation();
    this.state.progress = 0;
    this.state.messageIndex = 0;
    this.state.overlay.classList.remove('fade-out');
    this.state.overlay.style.display = 'flex';
    this.state.overlay.removeAttribute('aria-hidden');
    this.updateUI(this.state.messages[this.state.messageIndex]);

    this.state.interval = setInterval(() => {
      const increment = Math.random() * (this.state.progress > 70 ? 3 : 6);
      const ceiling = 96;
      const next = Math.min(this.state.progress + increment, ceiling);
      this.state.progress = Math.max(this.state.progress, next);

      if (Math.random() > 0.85 && this.state.progress < 94) {
        this.state.messageIndex =
          (this.state.messageIndex + 1) % this.state.messages.length;
        this.updateUI(this.state.messages[this.state.messageIndex]);
      } else {
        this.updateUI();
      }
    }, 100);
  }

  finalizeProgress(statusText = 'Bereit.') {
    this.stopSimulation();
    this.state.progress = 100;
    this.updateUI(statusText);
  }

  hide(options = {}) {
    if (this.hasHidden || !this.state.overlay) return;

    const elapsed = performance.now() - this.startTime;
    const delay = Math.max(0, this.MIN_DISPLAY_TIME - elapsed);

    setTimeout(() => {
      const earthContainer =
        getElementById('threeEarthContainer') ||
        getElementById('earth-container');

      const proceedToHide = () => {
        if (this.hasHidden) return;
        this.hasHidden = true;
        this.finalizeProgress();

        this.state.overlay.classList.add('fade-out');
        this.state.overlay.setAttribute('aria-hidden', 'true');
        this.state.overlay.dataset.loaderDone = 'true';

        const cleanup = () => {
          this.state.overlay.style.display = 'none';
          this.state.overlay.removeEventListener('transitionend', cleanup);
        };

        this.state.overlay.addEventListener('transitionend', cleanup);
        setTimeout(cleanup, 900);

        try {
          document.body.classList.remove('global-loading-visible');
        } catch {
          /* ignore */
        }

        fire(EVENTS.LOADING_HIDE);
        globalThis.dispatchEvent(new Event('app-ready'));
        log.info('Loading screen hidden');
      };

      if (!earthContainer) {
        proceedToHide();
        return;
      }

      // Grace period for earth container
      setTimeout(() => {
        if (options.debug) {
          log.debug('Earth grace period completed - proceeding to hide loader');
        }
        proceedToHide();
      }, 300);
    }, delay);
  }

  init() {
    this.startTime = performance.now();
    if (!this.bindElements()) return;

    try {
      document.body.classList.add('global-loading-visible');
    } catch {
      /* ignore */
    }

    this.startSimulation();
  }

  setStatus(message, progress) {
    if (!this.state.overlay || this.hasHidden) return;

    if (typeof progress === 'number') {
      this.state.progress = Math.min(
        Math.max(progress, this.state.progress),
        98,
      );
    }

    this.updateUI(message);
  }
}
