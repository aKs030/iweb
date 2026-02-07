/**
 * Global Loader Utility v3.1
 */

import { createLogger } from './logger.js';
import { EVENTS as CORE_EVENTS, fire } from './events.js';
import { i18n } from './i18n.js';

const log = createLogger('GlobalLoader');

const EVENTS = {
  LOADING_HIDE: CORE_EVENTS.LOADING_HIDE,
  LOADING_SHOW: 'loading:show',
  LOADING_UPDATE: 'loading:update',
  LOADING_TIMEOUT: 'loading:timeout',
};

let cachedElements = null;
let cacheTime = 0;
const CACHE_DURATION = 5000;

function getLoaderElements() {
  const now = Date.now();

  if (cachedElements && now - cacheTime < CACHE_DURATION) {
    return cachedElements;
  }

  const overlay = document.getElementById('app-loader');
  const statusText = document.getElementById('loader-status-text');
  const progressBar = document.getElementById('loader-progress-bar');
  const percentage = document.getElementById('loader-percentage');
  const announcement = document.getElementById('loader-announcement');

  if (!overlay || !statusText || !progressBar || !percentage) {
    cachedElements = null;
    return null;
  }

  cachedElements = {
    overlay,
    statusText,
    progressBar,
    percentage,
    announcement,
  };
  cacheTime = now;
  return cachedElements;
}

function clearCache() {
  cachedElements = null;
  cacheTime = 0;
}

export function updateLoader(progress, message, options = {}) {
  try {
    const elements = getLoaderElements();
    if (!elements) return;

    const { statusText, progressBar, percentage, announcement } = elements;
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

    const announcementText = `${message} ${widthValue}`;
    if (announcement && announcement.textContent !== announcementText) {
      announcement.textContent = announcementText;
    }

    fire(EVENTS.LOADING_UPDATE, { progress: pct, message });

    if (!options.silent) {
      log.debug(`Loader: ${pct}% - ${message}`);
    }
  } catch (err) {
    log.warn('Could not update loader:', err);
  }
}

export function hideLoader(delay = 0, options = {}) {
  try {
    const elements = getLoaderElements();
    if (!elements) return;

    const { overlay } = elements;

    setTimeout(() => {
      if (options.immediate) {
        if (elements.announcement) {
          elements.announcement.textContent = i18n.t('loader.app_loaded');
        }

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

      if (elements.announcement) {
        elements.announcement.textContent = i18n.t('loader.app_loaded');
      }

      setTimeout(() => {
        overlay.style.display = 'none';
        document.body.classList.remove('global-loading-visible');
        fire(EVENTS.LOADING_HIDE);
        globalThis.dispatchEvent(new Event('app-ready'));
        clearCache();
        log.debug('Loader hidden');
      }, 800);
    }, delay);
  } catch (err) {
    log.warn('Could not hide loader:', err);
  }
}
