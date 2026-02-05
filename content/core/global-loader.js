/**
 * Global Loader Utility v3.1
 */

import { createLogger } from './logger.js';
import { fire } from './events.js';
import { i18n } from '/content/core/i18n.js';

const log = createLogger('GlobalLoader');

const EVENTS = {
  LOADING_HIDE: 'loading:hide',
  LOADING_SHOW: 'loading:show',
  LOADING_UPDATE: 'loading:update',
  LOADING_TIMEOUT: 'loading:timeout',
};

let cachedElements = null;
let cacheTime = 0;
const CACHE_DURATION = 5000;

let loadingStartTime = 0;
let timeoutWarningTimer = null;
let performanceHintTimer = null;
const TIMEOUT_WARNING_DELAY = 8000;
const PERFORMANCE_HINT_DELAY = 3000;

function getLoaderElements() {
  const now = Date.now();

  if (cachedElements && now - cacheTime < CACHE_DURATION) {
    return cachedElements;
  }

  const overlay = document.getElementById('app-loader');
  const statusText = document.getElementById('loader-status-text');
  const progressBar = document.getElementById('loader-progress-bar');
  const percentage = document.getElementById('loader-percentage');
  const warning = document.getElementById('loader-warning');
  const hint = document.getElementById('loader-hint');

  if (!overlay || !statusText || !progressBar || !percentage) {
    cachedElements = null;
    return null;
  }

  cachedElements = {
    overlay,
    statusText,
    progressBar,
    percentage,
    warning,
    hint,
  };
  cacheTime = now;
  return cachedElements;
}

function clearCache() {
  cachedElements = null;
  cacheTime = 0;
}

function clearTimers() {
  if (timeoutWarningTimer) {
    clearTimeout(timeoutWarningTimer);
    timeoutWarningTimer = null;
  }
  if (performanceHintTimer) {
    clearTimeout(performanceHintTimer);
    performanceHintTimer = null;
  }
}

function showTimeoutWarning() {
  try {
    const elements = getLoaderElements();
    if (!elements || !elements.warning) return;
    elements.warning.classList.remove('hidden');
    fire(EVENTS.LOADING_TIMEOUT);
    log.warn('Loading timeout warning displayed');
  } catch (err) {
    log.warn('Could not show timeout warning:', err);
  }
}

function showPerformanceHint() {
  try {
    const elements = getLoaderElements();
    if (!elements || !elements.hint) return;
    elements.hint.setAttribute('aria-hidden', 'false');
  } catch (err) {
    log.warn('Could not show performance hint:', err);
  }
}

export function updateLoader(progress, message, options = {}) {
  try {
    const elements = getLoaderElements();
    if (!elements) return;

    const { statusText, progressBar, percentage } = elements;
    const pct = Math.round(Math.max(0, Math.min(100, progress * 100)));

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

    fire(EVENTS.LOADING_UPDATE, { progress: pct, message });

    if (!options.silent) {
      log.debug(`Loader: ${pct}% - ${message}`);
    }
  } catch (err) {
    log.warn('Could not update loader:', err);
  }
}

export function showLoader(message, options = {}) {
  const msg = message || i18n.t('common.loading');
  try {
    clearCache();
    clearTimers();
    const elements = getLoaderElements();
    if (!elements) return;

    const { overlay, warning, hint } = elements;

    if (warning) warning.classList.add('hidden');
    if (hint) hint.setAttribute('aria-hidden', 'true');

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

    loadingStartTime = Date.now();

    if (options.showWarning !== false) {
      timeoutWarningTimer = setTimeout(
        showTimeoutWarning,
        TIMEOUT_WARNING_DELAY,
      );
    }

    performanceHintTimer = setTimeout(
      showPerformanceHint,
      PERFORMANCE_HINT_DELAY,
    );

    fire(EVENTS.LOADING_SHOW, { message: msg });
    log.debug('Loader shown');
  } catch (err) {
    log.warn('Could not show loader:', err);
  }
}

export function hideLoader(delay = 0, options = {}) {
  try {
    const elements = getLoaderElements();
    if (!elements) return;

    const { overlay } = elements;

    clearTimers();

    const loadingDuration = Date.now() - loadingStartTime;
    if (loadingDuration > 0) {
      log.debug(`Loading completed in ${loadingDuration}ms`);
    }

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

export default {
  updateLoader,
  showLoader,
  hideLoader,
  isLoaderVisible,
  clearCache,
  clearTimers,
  EVENTS,
};
