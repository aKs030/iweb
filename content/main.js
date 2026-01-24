/**
 * Main Application Entry Point
 * @version 4.3.0
 * @last-modified 2026-01-24
 */

import { initHeroFeatureBundle } from '../pages/home/hero-manager.js';
import {
  createLazyLoadObserver,
  createLogger,
  EVENTS,
  fetchWithTimeout,
  fire,
  getElementById,
  schedulePersistentStorageRequest,
  AppLoadManager,
  SectionTracker,
  addListener,
} from '/content/utils/shared-utilities.js';
import { observeOnce } from '/content/utils/intersection-observer.js';
import { a11y } from './utils/accessibility-manager.js';
import './components/menu/menu.js';

const log = createLogger('main');

// Debug hooks for testing
globalThis.__threeEarthCleanup = null;

// ===== Configuration & Environment =====
const ENV = {
  isTest:
    new URLSearchParams(globalThis.location.search).has('test') ||
    navigator.userAgent.includes('HeadlessChrome') ||
    (globalThis.location.hostname === 'localhost' &&
      globalThis.navigator.webdriver),
  debug: new URLSearchParams(globalThis.location.search).has('debug'),
};

// ===== Performance Tracking =====
const perfMarks = {
  start: performance.now(),
  domReady: 0,
  modulesReady: 0,
  windowLoaded: 0,
};

// ===== DOM Utilities =====
const domCache = {
  appLoader: null,
  threeEarthContainer: null,
  snapContainer: null,
};

function getCachedElement(id, fallback = null) {
  const cacheKey = id.replace(/[^a-zA-Z]/g, '');
  if (!domCache[cacheKey]) {
    domCache[cacheKey] = getElementById(id) || fallback;
  }
  return domCache[cacheKey];
}

function getThreeEarthContainer() {
  return (
    getCachedElement('threeEarthContainer') ||
    getCachedElement('earth-container')
  );
}

function getAppLoader() {
  return getCachedElement('app-loader');
}

// ===== Accessibility Announcements =====
const announce = (() => {
  const cache = new Map();

  return (message, { assertive = false, dedupe = false } = {}) => {
    if (!message) return;

    if (dedupe && cache.has(message)) return;
    if (dedupe) {
      cache.set(message, true);
      setTimeout(() => cache.delete(message), 3000);
    }

    try {
      const id = assertive ? 'live-region-assertive' : 'live-region-status';
      const region = getElementById(id);
      if (!region) return;

      region.textContent = '';
      requestAnimationFrame(() => {
        region.textContent = message;
      });
    } catch (error) {
      log.debug('Announcement failed:', error);
    }
  };
})();

globalThis.announce = announce;

// ===== Section Tracker =====
const sectionTracker = new SectionTracker();
sectionTracker.init();

// ===== Section Loader =====
const SectionLoader = (() => {
  if (globalThis.SectionLoader) return globalThis.SectionLoader;

  const SELECTOR = 'section[data-section-src]';
  const loadedSections = new WeakSet();
  const retryAttempts = new WeakMap();
  const MAX_RETRIES = 2;

  function dispatchEvent(type, section, detail = {}) {
    try {
      document.dispatchEvent(
        new CustomEvent(type, {
          detail: { id: section?.id, section, ...detail },
        }),
      );
    } catch (error) {
      log.debug(`Event dispatch failed: ${type}`, error);
    }
  }

  function getSectionName(section) {
    const labelId = section.getAttribute('aria-labelledby');
    if (labelId) {
      const label = getElementById(labelId);
      const text = label?.textContent?.trim();
      if (text) return text;
    }
    return section.id || 'Abschnitt';
  }

  function getFetchCandidates(url) {
    if (url?.endsWith('.html')) {
      return [url.replace(/\.html$/, ''), url];
    } else if (url?.startsWith('/pages/')) {
      return [(url || '') + '.html', url];
    } else {
      return [url, (url || '') + '.html'];
    }
  }

  async function fetchSectionContent(url) {
    let response;
    const fetchCandidates = getFetchCandidates(url);
    for (const candidate of fetchCandidates) {
      try {
        response = await fetchWithTimeout(candidate);
        if (response && response.ok) break;
      } catch {
        response = null;
      }
    }
    if (!response || !response.ok) {
      throw new Error(
        `HTTP ${response ? response.status : 'NO_RESPONSE'}: ${
          response ? response.statusText : 'no response'
        }`,
      );
    }
    return await response.text();
  }

  async function loadSection(section) {
    if (loadedSections.has(section)) return;

    const url = section.dataset.sectionSrc;
    if (!url) {
      section.removeAttribute('aria-busy');
      return;
    }

    // On subpages, skip eager loading non-critical sections
    const isHomePage =
      (globalThis.location?.pathname || '').replace(/\/+$/g, '') === '';
    const isEager = section.dataset.eager === 'true';
    if (!isHomePage && !isEager) {
      return;
    }

    loadedSections.add(section);
    const sectionName = getSectionName(section);
    const attempts = retryAttempts.get(section) || 0;

    section.setAttribute('aria-busy', 'true');
    section.dataset.state = 'loading';

    announce(`Lade ${sectionName}…`, { dedupe: true });
    dispatchEvent('section:will-load', section, { url });

    try {
      const html = await fetchSectionContent(url);
      section.insertAdjacentHTML('beforeend', html);

      const template = section.querySelector('template');
      if (template) {
        section.appendChild(template.content.cloneNode(true));
      }

      section
        .querySelectorAll('.section-skeleton')
        .forEach((el) => el.remove());

      section.dataset.state = 'loaded';
      section.removeAttribute('aria-busy');

      announce(`${sectionName} geladen`, { dedupe: true });
      dispatchEvent('section:loaded', section, { state: 'loaded' });

      if (section.id === 'hero') {
        fire(EVENTS.HERO_LOADED);
      }
    } catch (error) {
      log.warn(`Section load failed: ${sectionName}`, error);

      const isTransient = /5\d\d/.test(String(error)) || !navigator.onLine;
      const shouldRetry = isTransient && attempts < MAX_RETRIES;

      if (shouldRetry) {
        retryAttempts.set(section, attempts + 1);
        loadedSections.delete(section);

        const delay = 300 * Math.pow(2, attempts);
        await new Promise((resolve) => setTimeout(resolve, delay));

        return loadSection(section);
      }

      section.dataset.state = 'error';
      section.removeAttribute('aria-busy');

      announce(`Fehler beim Laden von ${sectionName}`, { assertive: true });
      dispatchEvent('section:error', section, { state: 'error' });

      // Inject retry UI
      if (!section.querySelector('.section-retry')) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'section-retry';
        button.textContent = 'Erneut laden';
        const _onRetryClick = () => retrySection(section);
        const _removeRetry = addListener(button, 'click', _onRetryClick, {
          once: true,
        });
        button.__listenerRemovers = button.__listenerRemovers || [];
        button.__listenerRemovers.push(_removeRetry);

        const wrapper = document.createElement('div');
        wrapper.className = 'section-error-box';
        wrapper.appendChild(button);
        section.appendChild(wrapper);
      }
    }
  }

  async function retrySection(section) {
    section.querySelectorAll('.section-error-box').forEach((el) => el.remove());
    section.dataset.state = '';
    loadedSections.delete(section);
    retryAttempts.delete(section);
    await loadSection(section);
  }

  function init() {
    if (init._initialized) return;
    init._initialized = true;

    const sections = Array.from(document.querySelectorAll(SELECTOR));
    const eagerSections = [];
    const lazySections = [];

    sections.forEach((section) => {
      if (section.dataset.eager !== undefined) {
        eagerSections.push(section);
      } else {
        lazySections.push(section);
      }
    });

    eagerSections.forEach(loadSection);

    if (lazySections.length) {
      const observer = createLazyLoadObserver(loadSection);
      lazySections.forEach((section) => observer.observe(section));
    }
  }

  function reinit() {
    init._initialized = false;
    init();
  }

  const api = { init, reinit, loadSection, retrySection };
  globalThis.SectionLoader = api;
  return api;
})();

function _initApp() {
  SectionLoader.init();
  try {
    a11y?.updateAnimations?.();
    a11y?.updateContrast?.();
  } catch {
    // Ignore
  }
}

if (document.readyState !== 'loading') {
  _initApp();
} else {
  document.addEventListener(EVENTS.DOM_READY, _initApp, { once: true });
}

// ===== Scroll Snapping =====
const ScrollSnapping = (() => {
  let snapTimer = null;
  const snapContainer = getCachedElement(
    'snap-container',
    document.documentElement,
  );

  const disableSnap = () => snapContainer.classList.add('no-snap');
  const enableSnap = () => snapContainer.classList.remove('no-snap');

  function handleScroll() {
    disableSnap();
    clearTimeout(snapTimer);
    snapTimer = setTimeout(enableSnap, 150);
  }

  function handleKey(event) {
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
      handleScroll();
    }
  }

  function init() {
    globalThis.addEventListener('wheel', handleScroll, { passive: true });
    globalThis.addEventListener('touchmove', handleScroll, { passive: true });
    globalThis.addEventListener('keydown', handleKey, { passive: true });
  }

  return { init };
})();

ScrollSnapping.init();

// ===== Loading Screen Manager =====
const LoadingScreenManager = (() => {
  const MIN_DISPLAY_TIME = 500;
  const state = {
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

  let startTime = 0;
  let hasHidden = false;

  function bindElements() {
    state.overlay = getAppLoader();
    state.bar = getElementById('loader-progress-bar');
    state.text = getElementById('loader-status-text');
    state.percent = getElementById('loader-percentage');
    return Boolean(state.overlay);
  }

  function updateUI(statusText) {
    if (state.bar) state.bar.style.width = `${Math.floor(state.progress)}%`;
    if (state.percent)
      state.percent.textContent = `${Math.floor(state.progress)}%`;
    if (statusText && state.text) state.text.textContent = statusText;
  }

  function stopSimulation() {
    if (state.interval) {
      clearInterval(state.interval);
      state.interval = null;
    }
  }

  function startSimulation() {
    if (!state.overlay) return;

    stopSimulation();
    state.progress = 0;
    state.messageIndex = 0;
    state.overlay.classList.remove('fade-out');
    state.overlay.style.display = 'flex';
    state.overlay.removeAttribute('aria-hidden');
    updateUI(state.messages[state.messageIndex]);

    state.interval = setInterval(() => {
      const increment = Math.random() * (state.progress > 70 ? 3 : 6);
      const ceiling = 96;
      const next = Math.min(state.progress + increment, ceiling);
      state.progress = Math.max(state.progress, next);

      if (Math.random() > 0.85 && state.progress < 94) {
        state.messageIndex = (state.messageIndex + 1) % state.messages.length;
        updateUI(state.messages[state.messageIndex]);
      } else {
        updateUI();
      }
    }, 100);
  }

  function finalizeProgress(statusText = 'Bereit.') {
    stopSimulation();
    state.progress = 100;
    updateUI(statusText);
  }

  function hide() {
    if (hasHidden) return;
    if (!state.overlay) return;

    const elapsed = performance.now() - startTime;
    const delay = Math.max(0, MIN_DISPLAY_TIME - elapsed);

    setTimeout(() => {
      const earthContainerPresent = getThreeEarthContainer();

      const proceedToHide = () => {
        if (hasHidden) return;
        hasHidden = true;
        finalizeProgress();

        state.overlay.classList.add('fade-out');
        state.overlay.setAttribute('aria-hidden', 'true');
        state.overlay.dataset.loaderDone = 'true';

        const cleanup = () => {
          state.overlay.style.display = 'none';
          state.overlay.removeEventListener('transitionend', cleanup);
        };

        state.overlay.addEventListener('transitionend', cleanup);
        setTimeout(cleanup, 900);

        try {
          document.body.classList.remove('global-loading-visible');
        } catch {
          /* ignore */
        }

        perfMarks.loadingHidden = performance.now();
        announce('Anwendung geladen', { dedupe: true });
        fire(EVENTS.LOADING_HIDE);
        globalThis.dispatchEvent(new Event('app-ready'));
      };

      if (!earthContainerPresent) {
        proceedToHide();
        return;
      }

      setTimeout(() => {
        if (ENV.debug) {
          log.debug('Earth grace period completed - proceeding to hide loader');
        }
        proceedToHide();
      }, 300);
    }, delay);
  }

  function init() {
    startTime = performance.now();
    if (!bindElements()) return;

    try {
      document.body.classList.add('global-loading-visible');
    } catch {
      /* ignore */
    }

    startSimulation();
  }

  function setStatus(message, progress) {
    if (!state.overlay || hasHidden) return;

    if (typeof progress === 'number') {
      state.progress = Math.min(Math.max(progress, state.progress), 98);
    }

    updateUI(message);
  }

  return { init, hide, setStatus };
})();

// ===== Three.js Earth System Loader =====
const ThreeEarthLoader = (() => {
  let cleanupFn = null;
  let isLoading = false;

  async function load() {
    if (isLoading || cleanupFn) return;

    if (ENV.isTest && !globalThis.__FORCE_THREE_EARTH) {
      log.info('Test environment - skipping Three.js Earth');
      return;
    }

    const container = getThreeEarthContainer();
    if (!container) {
      log.debug('Earth container not found');
      return;
    }

    if (navigator.connection?.saveData) {
      log.info('Three.js skipped: save-data mode');
      return;
    }

    isLoading = true;

    try {
      log.info('Loading Three.js Earth system...');
      const { initThreeEarth } =
        await import('./components/particles/three-earth-system.js');

      if (typeof initThreeEarth !== 'function') {
        throw new Error('initThreeEarth not found in module exports');
      }

      cleanupFn = await initThreeEarth();

      if (typeof cleanupFn === 'function') {
        globalThis.__threeEarthCleanup = cleanupFn;
        log.info('Three.js Earth system initialized');
        perfMarks.threeJsLoaded = performance.now();
      }
    } catch (error) {
      log.warn('Three.js failed, using CSS fallback:', error);
    } finally {
      isLoading = false;
    }
  }

  function init() {
    const container = getThreeEarthContainer();
    if (!container) return;

    try {
      const rect = container.getBoundingClientRect();
      const withinMargin =
        rect.top < (globalThis.innerHeight || 0) + 100 && rect.bottom > -100;
      const loaderVisible = getAppLoader()?.dataset?.loaderDone !== 'true';

      if (withinMargin || loaderVisible) {
        load();
        return;
      }
    } catch {
      // Fallback to observer
    }

    observeOnce(container, () => load(), {
      rootMargin: '400px',
      threshold: 0.01,
    });
  }

  function initDelayed() {
    const idleCallback = globalThis.requestIdleCallback || setTimeout;
    idleCallback(() => init(), { timeout: 2000 });
  }

  return { initDelayed };
})();

// ===== Application Bootstrap =====
document.addEventListener(
  'DOMContentLoaded',
  async () => {
    perfMarks.domReady = performance.now();
    LoadingScreenManager.init();

    fire(EVENTS.DOM_READY);

    // Simplified TypeWriter Export — legacy global exposure removed; prefer importing initHeroSubtitle where needed.

    let modulesReady = false;
    let windowLoaded = false;

    const checkReady = () => {
      if (!modulesReady || !windowLoaded) return;
      const blocked =
        typeof AppLoadManager !== 'undefined' &&
        typeof AppLoadManager.isBlocked === 'function' &&
        AppLoadManager.isBlocked();
      if (blocked) return;

      // Ensure Three.js Earth signaled readiness if present
      const earthContainer = getThreeEarthContainer();
      const earthReady = earthContainer?.dataset?.threeReady === '1';
      if (earthContainer && !earthReady) {
        return;
      }

      LoadingScreenManager.setStatus('Starte Experience...', 98);
      LoadingScreenManager.hide();
    };

    document.addEventListener(EVENTS.LOADING_UNBLOCKED, checkReady);

    globalThis.addEventListener(
      'load',
      () => {
        perfMarks.windowLoaded = performance.now();
        windowLoaded = true;
        LoadingScreenManager.setStatus('Finalisiere Assets...', 92);
        checkReady();
      },
      { once: true },
    );

    fire(EVENTS.CORE_INITIALIZED);
    fire(EVENTS.HERO_INIT_READY);
    initHeroFeatureBundle();

    ThreeEarthLoader.initDelayed();

    modulesReady = true;
    perfMarks.modulesReady = performance.now();
    LoadingScreenManager.setStatus('Initialisiere 3D-Engine...', 90);
    fire(EVENTS.MODULES_READY);
    checkReady();

    // Smart force-hide with retry logic
    (function scheduleSmartForceHide(attempt = 1) {
      const DEFAULT_DELAY = 4000; // Reduziert von 5000ms
      const EXTENDED_DELAY = 6000; // Reduziert von 8000ms
      const RETRY_DELAY = 3000; // Reduziert von 5000ms
      const MAX_ATTEMPTS = 3;

      const computeDelay = () => {
        try {
          if (typeof AppLoadManager?.getPending === 'function') {
            const pending = AppLoadManager.getPending() || [];
            if (pending.includes('three-earth')) return EXTENDED_DELAY;
          }
        } catch {
          // Fallback to default
        }
        return DEFAULT_DELAY;
      };

      const initialDelay = computeDelay();

      setTimeout(
        () => {
          if (windowLoaded) return;

          try {
            if (
              typeof AppLoadManager?.isBlocked === 'function' &&
              AppLoadManager.isBlocked()
            ) {
              const pending = AppLoadManager.getPending?.() || [];
              log.warn(
                `Deferring forced hide (attempt ${attempt}): blocking modules=${pending.join(', ')}`,
              );

              if (attempt < MAX_ATTEMPTS) {
                scheduleSmartForceHide(attempt + 1);
                return;
              }
              log.warn('Max attempts reached - forcing hide');
            }
          } catch (e) {
            log.debug('AppLoadManager check failed', e);
          }

          const pending = AppLoadManager?.getPending?.() || [];
          log.info(
            'Forcing loading screen hide after timeout',
            pending.length ? { pendingModules: pending } : undefined,
          );
          LoadingScreenManager.setStatus('Schließe Ladebildschirm...');
          LoadingScreenManager.hide();
        },
        attempt === 1 ? initialDelay : RETRY_DELAY,
      );
    })();

    schedulePersistentStorageRequest(2200);

    // Activate deferred styles
    const activateDeferredStyles = () => {
      try {
        const links = document.querySelectorAll(
          'link[rel="stylesheet"][data-defer="1"]',
        );
        links.forEach((link) => {
          try {
            link.media = 'all';
            delete link.dataset.defer;
          } catch {
            // Ignore
          }
        });
      } catch {
        // Ignore
      }
    };

    try {
      activateDeferredStyles();

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', activateDeferredStyles, {
          once: true,
        });
      } else {
        setTimeout(activateDeferredStyles, 0);
      }
      globalThis.addEventListener('load', activateDeferredStyles);

      // Observe head for dynamically inserted deferred links
      const headObserver = new MutationObserver((mutations) => {
        for (const m of mutations) {
          for (const node of m.addedNodes) {
            try {
              if (
                node.nodeType === 1 &&
                node.matches?.('link[rel="stylesheet"][data-defer="1"]')
              ) {
                node.media = 'all';
                delete node.dataset.defer;
              }
            } catch {
              // Ignore
            }
          }
        }
      });
      headObserver.observe(document.head || document.documentElement, {
        childList: true,
        subtree: true,
      });
      globalThis.addEventListener('load', () => headObserver.disconnect(), {
        once: true,
      });
    } catch {
      // Ignore
    }

    // Delegated event handlers for retry and share buttons
    const _onDocDelegatedClick = (event) => {
      const target = event.target;
      if (!target) return;

      // Retry/reload buttons
      const retry = target?.closest('.retry-btn');
      if (retry) {
        event.preventDefault();
        try {
          globalThis.location.reload();
        } catch {
          // Fallback
        }
        return;
      }

      // Share button
      const share = target?.closest('.btn-share');
      if (share) {
        event.preventDefault();
        const shareUrl =
          share.dataset.shareUrl || 'https://www.youtube.com/@aks.030';
        const shareData = {
          title: document.title,
          text: 'Schau dir diesen Kanal an',
          url: shareUrl,
        };

        if (navigator.share) {
          navigator
            .share(shareData)
            .catch((err) => log.warn('share failed', err));
        } else if (navigator.clipboard) {
          navigator.clipboard.writeText(shareUrl).then(() => {
            try {
              announce('Link kopiert', { dedupe: true });
            } catch (err) {
              log.warn('announce failed', err);
            }
          });
        } else {
          try {
            globalThis.prompt('Link kopieren', shareUrl);
          } catch (err) {
            log.warn('prompt failed', err);
          }
        }
        return;
      }
    };
    const _removeMainDelegated = addListener(
      document,
      'click',
      _onDocDelegatedClick,
    );
    globalThis.__main_delegated_remove = _removeMainDelegated;

    log.info('Performance:', {
      domReady: Math.round(perfMarks.domReady - perfMarks.start),
      modulesReady: Math.round(perfMarks.modulesReady - perfMarks.start),
      windowLoaded: Math.round(perfMarks.windowLoaded - perfMarks.start),
    });
  },
  { once: true },
);

// ===== BFCache / Back Button Handling =====
globalThis.addEventListener('pageshow', (event) => {
  if (event.persisted) {
    log.info('Page restored from bfcache');
    globalThis.dispatchEvent(new CustomEvent('resize'));

    if (
      !document.hidden &&
      globalThis.threeEarthSystem &&
      globalThis.threeEarthSystem.animate
    ) {
      document.dispatchEvent(new CustomEvent('visibilitychange'));
    }
  }
});
