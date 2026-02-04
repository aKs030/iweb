/**
 * Global Loader Utility
 * @version 3.0.0
 * @description Optimized utility functions to control the global loading screen
 * @last-modified 2026-01-31
 */

import { createLogger } from './logger.js';
import { fire } from './events.js';
import { i18n } from '/content/core/i18n.js';

const log = createLogger('GlobalLoader');

// Events
const EVENTS = {
  LOADING_HIDE: 'loading:hide',
  LOADING_SHOW: 'loading:show',
  LOADING_UPDATE: 'loading:update',
};

// Cache loader elements for better performance
let cachedElements = null;
let cacheTime = 0;
const CACHE_DURATION = 5000; // 5 seconds

/**
 * Get global loader elements with caching
 * @returns {{overlay: HTMLElement, statusText: HTMLElement, progressBar: HTMLElement, percentage: HTMLElement} | null}
 */
function getLoaderElements() {
  const now = Date.now();

  // Return cached elements if still valid
  if (cachedElements && now - cacheTime < CACHE_DURATION) {
    return cachedElements;
  }

  const overlay = document.getElementById('app-loader');
  const statusText = document.getElementById('loader-status-text');
  const progressBar = document.getElementById('loader-progress-bar');
  const percentage = document.getElementById('loader-percentage');

  if (!overlay || !statusText || !progressBar || !percentage) {
    cachedElements = null;
    return null;
  }

  cachedElements = { overlay, statusText, progressBar, percentage };
  cacheTime = now;
  return cachedElements;
}

/**
 * Clear element cache (call when DOM changes)
 */
function clearCache() {
  cachedElements = null;
  cacheTime = 0;
}

/**
 * Update global loader progress
 * @param {number} progress - Progress from 0 to 1
 * @param {string} message - Status message
 * @param {Object} [options] - Additional options
 * @param {boolean} [options.silent] - Don't log debug message
 */
export function updateLoader(progress, message, options = {}) {
  try {
    const elements = getLoaderElements();
    if (!elements) return;

    const { statusText, progressBar, percentage } = elements;
    const pct = Math.round(Math.max(0, Math.min(100, progress * 100)));

    // Batch DOM updates
    if (statusText && statusText.textContent !== message) {
      statusText.textContent = message;
    }

    const widthValue = `${pct}%`;
    if (progressBar && progressBar.style.width !== widthValue) {
      progressBar.style.width = widthValue;
    }

    if (percentage && percentage.textContent !== widthValue) {
      percentage.textContent = widthValue;
    }

    // Fire event for listeners
    fire(EVENTS.LOADING_UPDATE, { progress: pct, message });

    if (!options.silent) {
      log.debug(`Loader: ${pct}% - ${message}`);
    }
  } catch (err) {
    log.warn('Could not update loader:', err);
  }
}

/**
 * Show global loader
 * @param {string} message - Initial message
 * @param {Object} [options] - Additional options
 * @param {number} [options.initialProgress] - Initial progress (0-1)
 */
export function showLoader(message, options = {}) {
  const msg = message || i18n.t('common.loading');
  try {
    clearCache(); // Clear cache when showing loader
    const elements = getLoaderElements();
    if (!elements) return;

    const { overlay } = elements;

    overlay.classList.remove('fade-out', 'hidden');
    overlay.removeAttribute('aria-hidden');
    overlay.setAttribute('aria-live', 'polite');
    overlay.setAttribute('role', 'status');
    overlay.dataset.loaderDone = 'false';

    Object.assign(overlay.style, {
      display: 'flex',
      opacity: '1',
      pointerEvents: 'auto',
      visibility: 'visible',
    });

    const initialProgress = options.initialProgress ?? 0;
    updateLoader(initialProgress, msg, { silent: true });
    document.body.classList.add('global-loading-visible');

    fire(EVENTS.LOADING_SHOW, { message: msg });
    log.debug('Loader shown');
  } catch (err) {
    log.warn('Could not show loader:', err);
  }
}

/**
 * Hide global loader with smooth transition
 * @param {number} delay - Delay in ms before hiding (default: 0)
 * @param {Object} [options] - Additional options
 * @param {boolean} [options.immediate] - Skip fade animation
 */
export function hideLoader(delay = 0, options = {}) {
  try {
    const elements = getLoaderElements();
    if (!elements) return;

    const { overlay } = elements;

    setTimeout(() => {
      if (options.immediate) {
        overlay.style.display = 'none';
        overlay.setAttribute('aria-hidden', 'true');
        overlay.dataset.loaderDone = 'true';
        document.body.classList.remove('global-loading-visible');
        fire(EVENTS.LOADING_HIDE);
        globalThis.dispatchEvent(new Event('app-ready'));
        clearCache();
        log.debug('Loader hidden (immediate)');
        return;
      }

      overlay.classList.add('fade-out');
      overlay.setAttribute('aria-hidden', 'true');
      overlay.removeAttribute('aria-live');
      overlay.dataset.loaderDone = 'true';

      setTimeout(() => {
        overlay.style.display = 'none';
        document.body.classList.remove('global-loading-visible');
        clearCache();
      }, 800);

      fire(EVENTS.LOADING_HIDE);
      globalThis.dispatchEvent(new Event('app-ready'));
      log.debug('Loader hidden');
    }, delay);
  } catch (err) {
    log.warn('Could not hide loader:', err);
  }
}

/**
 * Check if loader is currently visible
 * @returns {boolean}
 */
export function isLoaderVisible() {
  try {
    const elements = getLoaderElements();
    if (!elements) return false;

    const { overlay } = elements;
    return (
      overlay.style.display !== 'none' && overlay.dataset.loaderDone !== 'true'
    );
  } catch {
    return false;
  }
}

// Export all functions as default object for backward compatibility
export default {
  updateLoader,
  showLoader,
  hideLoader,
  isLoaderVisible,
  clearCache,
};
