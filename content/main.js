/**
 * Main Application Entry Point - Optimized
 * * OPTIMIZATIONS v4.1 (Performance):
 * - Fine-tuned ThreeEarthLoader init
 * - Ensure proper cleanup references
 * * @version 4.1.1
 * @last-modified 2026-01-04
 */

import { initHeroFeatureBundle } from '../pages/home/hero-manager.js';
import {
  createLazyLoadObserver,
  EVENTS,
  fire,
  getElementById,
  schedulePersistentStorageRequest,
  AppLoadManager,
  SectionTracker,
  addListener,
} from '/content/utils/shared-utilities.js';
import { observeOnce } from '/content/utils/observers/intersection-observer.js';
import { a11y } from './utils/accessibility-manager.js';

// Import performance optimizations
import './utils/observers/lazy-loader.js';
import './utils/resource-hints.js';
import './utils/error-handler.js';

import './components/menu/menu.js';
import './components/footer/footer-simple.js';

const log = a11y?.createLogger?.('main') || console;

// Debug / Dev hooks (exported for test & debug tooling)
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

// Use centralized accessibility manager instead of duplicate implementation
globalThis.announce = (message, options = {}) => {
  try {
    if (a11y && typeof a11y.announce === 'function') {
      a11y.announce(message, {
        priority: options.assertive ? 'assertive' : 'polite',
        clearPrevious: true,
      });
    }
  } catch (error) {
    // Fallback: log to console if accessibility manager fails
    // eslint-disable-next-line no-console
    console.log(`[Announce] ${message}`);
  }
};

// ===== Section Tracker =====
const sectionTracker = new SectionTracker();
sectionTracker.init();

// ===== Section Loader =====
const SectionLoader = (() => {
  // Check if already initialized to prevent double execution
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
        // Use simple fetch instead of fetchWithTimeout for debugging
        response = await fetch(candidate);
        if (response && response.ok) {
          break;
        }
      } catch (error) {
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
    const url = section.dataset.sectionSrc;
    if (!url) {
      section.removeAttribute('aria-busy');
      return;
    }

    // Check if section already has content (not just skeleton)
    const hasRealContent = section.querySelector(':not(.section-skeleton)');
    if (hasRealContent && loadedSections.has(section)) {
      return;
    }

    // Optimization: On subpages, skip eager loading non-critical sections
    // Let IntersectionObserver handle lazy-loading instead
    const isHomePage =
      (globalThis.location?.pathname || '').replace(/\/+$/g, '') === '';
    const isEager = section.dataset.eager === 'true';

    if (!isEager && !isHomePage) {
      // Will be loaded lazily when IntersectionObserver detects visibility
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

      // Security: Validate that HTML comes from trusted internal sources
      if (!url.startsWith('/') && !url.startsWith('./')) {
        throw new Error('Only internal URLs are allowed for section loading');
      }

      // Import sanitization utility if needed
      // For a portfolio site, basic validation is sufficient
      if (!url.startsWith('/') && !url.startsWith('./')) {
        throw new Error('Only internal URLs are allowed for section loading');
      }

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

      // Inline injectRetryUI: inject a small retry UI directly
      if (!section.querySelector('.section-retry')) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'section-retry';
        button.textContent = 'Erneut laden';
        const _onRetryClick = () => retrySection(section);
        const _removeRetry = addListener(button, 'click', _onRetryClick, {
          once: true,
        });
        // store remover to allow cleanup
        button.__listenerRemovers = button.__listenerRemovers || [];
        button.__listenerRemovers.push(_removeRetry);

        const wrapper = document.createElement('div');
        wrapper.className = 'section-error-box';
        wrapper.appendChild(button);
        section.appendChild(wrapper);
      }
    }
  }

  // injectRetryUI removed; kept inline in loadSection() to avoid small helper function

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
  // Export to globalThis for compatibility with inline handlers if any, but prefer ES import
  globalThis.SectionLoader = api;
  return api;
})();

function _initApp() {
  SectionLoader.init();
  // Ensure accessibility preferences applied right away
  try {
    a11y?.updateAnimations?.();
    a11y?.updateContrast?.();
  } catch {
    /* ignored */
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
  const snapContainer =
    document.querySelector('.snap-container') || document.documentElement;

  const disableSnap = () => snapContainer.classList.add('no-snap');
  const enableSnap = () => snapContainer.classList.remove('no-snap');

  function handleScroll() {
    disableSnap();
    clearTimeout(snapTimer);
    snapTimer = setTimeout(enableSnap, 180);
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
  const MIN_DISPLAY_TIME = 600;
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
      'Verbinde Neural Interface...',
      'Rendere 3D-Umgebung...',
      'Optimiere Shader...',
      'Starte KI-Module...',
      'Synchronisiere Daten...',
    ],
  };

  let startTime = 0;
  let hasHidden = false;

  function bindElements() {
    state.overlay = getElementById('app-loader');
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
      const increment = Math.random() * (state.progress > 70 ? 2 : 5);
      const ceiling = 96;
      const next = Math.min(state.progress + increment, ceiling);
      state.progress = Math.max(state.progress, next);

      // Rotate messages for a subtle "system" feel
      if (Math.random() > 0.8 && state.progress < 94) {
        state.messageIndex = (state.messageIndex + 1) % state.messages.length;
        updateUI(state.messages[state.messageIndex]);
      } else {
        updateUI();
      }
    }, 120);
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
      // If there's an Earth container on the page, wait up to 4s for the
      // 'earth-ready' signal (or compatible signals) to avoid hiding the
      // loader before the 3D canvas can show a visible frame.
      const earthContainerPresent =
        document.querySelector('#threeEarthContainer') ||
        document.querySelector('#earth-container');

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

      // Three.js Earth system now unblocks itself immediately after initialization
      // No need to wait for events here - just proceed after a short grace period
      setTimeout(() => {
        if (ENV.debug) {
          log.debug('Earth grace period completed - proceeding to hide loader');
        }
        proceedToHide();
      }, 500);
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
  let loadPromise = null;

  // Performance monitoring
  const perfMetrics = {
    loadStart: 0,
    moduleLoaded: 0,
    initComplete: 0,
    firstFrame: 0,
  };

  async function load() {
    if (isLoading || cleanupFn) return loadPromise;

    // Explicitly check env for testing to skip heavy WebGL
    // ALLOW for specific verification script if requested via global override
    if (ENV.isTest && !globalThis.__FORCE_THREE_EARTH) {
      log.info(
        'Test environment detected - skipping Three.js Earth system for performance',
      );
      return Promise.resolve();
    }

    const container = getElementById('threeEarthContainer');
    if (!container) {
      log.debug('Earth container not found');
      return Promise.resolve();
    }

    // Enhanced performance guards
    try {
      // Check for save-data preference
      if (navigator.connection?.saveData) {
        log.info('Three.js skipped: save-data mode detected');
        return Promise.resolve();
      }

      // Check device capabilities
      const canvas = document.createElement('canvas');
      const gl =
        canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (!gl) {
        log.info('Three.js skipped: WebGL not supported');
        return Promise.resolve();
      }

      // Check for low-end devices
      const renderer = gl.getParameter(gl.RENDERER) || '';
      const isLowEnd =
        /Mali-400|Adreno \(TM\) 2|PowerVR SGX 5|Intel.*HD Graphics [23]/i.test(
          renderer,
        );
      if (isLowEnd) {
        log.info('Three.js skipped: low-end GPU detected');
        return Promise.resolve();
      }

      // Memory check
      if (navigator.deviceMemory && navigator.deviceMemory < 2) {
        log.info('Three.js skipped: insufficient device memory');
        return Promise.resolve();
      }
    } catch (err) {
      log.warn(
        'Three.js capability check failed, proceeding with caution:',
        err,
      );
    }

    isLoading = true;
    perfMetrics.loadStart = performance.now();

    // Create loading promise to prevent duplicate loads
    loadPromise = (async () => {
      try {
        log.info('Loading Three.js Earth system...');

        // Network-adaptive timeout for module loading
        const getModuleTimeout = () => {
          try {
            const connection =
              navigator.connection ||
              navigator.mozConnection ||
              navigator.webkitConnection;
            if (connection) {
              switch (connection.effectiveType) {
                case 'slow-2g':
                  return 20000;
                case '2g':
                  return 15000;
                case '3g':
                  return 12000;
                case '4g':
                  return 10000;
                default:
                  return 10000;
              }
            }
          } catch {
            // Fallback for browsers without Network Information API
          }
          return 10000; // Default timeout
        };

        // Progressive loading with adaptive timeout
        const modulePromise = import(
          './components/particles/three-earth-system.js'
        );
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error('Three.js module load timeout')),
            getModuleTimeout(),
          ),
        );

        const module = await Promise.race([modulePromise, timeoutPromise]);
        perfMetrics.moduleLoaded = performance.now();

        if (typeof module.initThreeEarth !== 'function') {
          throw new Error('initThreeEarth not found in module exports');
        }

        // Initialize with performance monitoring
        cleanupFn = await module.initThreeEarth();
        perfMetrics.initComplete = performance.now();

        if (typeof cleanupFn === 'function') {
          // Export the cleanup function for programmatic control
          globalThis.__threeEarthCleanup = cleanupFn;

          // Monitor first frame render
          requestAnimationFrame(() => {
            perfMetrics.firstFrame = performance.now();

            // Log performance metrics
            const metrics = {
              moduleLoad: Math.round(
                perfMetrics.moduleLoaded - perfMetrics.loadStart,
              ),
              initialization: Math.round(
                perfMetrics.initComplete - perfMetrics.moduleLoaded,
              ),
              firstFrame: Math.round(
                perfMetrics.firstFrame - perfMetrics.initComplete,
              ),
              total: Math.round(perfMetrics.firstFrame - perfMetrics.loadStart),
            };

            log.info('Three.js Earth system performance:', metrics);

            // Mark container as ready
            container.dataset.threeReady = '1';
            container.dispatchEvent(
              new CustomEvent('three-earth-ready', {
                detail: { metrics },
              }),
            );
          });

          log.info('Three.js Earth system initialized');
          perfMarks.threeJsLoaded = performance.now();
        }

        return cleanupFn;
      } catch (error) {
        log.warn('Three.js failed, using CSS fallback:', error);

        // Add fallback CSS animation
        container.classList.add('three-fallback');
        container.innerHTML = `
          <div class="earth-fallback">
            <div class="earth-sphere"></div>
            <div class="earth-glow"></div>
          </div>
        `;

        return null;
      } finally {
        isLoading = false;
      }
    })();

    return loadPromise;
  }

  function init() {
    const container = getElementById('threeEarthContainer');
    if (!container) return;

    // Immediate visibility check: if the container is already within the
    // rootMargin area *or* the global loader is still visible, trigger load
    // immediately so the Earth is prepared while the loader is active.
    try {
      const rect = container.getBoundingClientRect();
      const withinMargin =
        rect.top < (globalThis.innerHeight || 0) + 100 && rect.bottom > -100;
      const loaderVisible =
        document.querySelector('#app-loader')?.dataset?.loaderDone !== 'true';

      if (withinMargin || loaderVisible) {
        load();
        return;
      }
    } catch {
      // ignore and fallback to observer
    }

    // Use a one-shot observer helper for simpler semantics
    observeOnce(
      container,
      () => {
        load();
      },
      { rootMargin: '400px', threshold: 0.01 },
    );
  }

  // Use a safe idleCallback wrapper that simulates a deadline when native API is absent
  function idleCallbackWrapper(cb, opts) {
    if (typeof globalThis.requestIdleCallback === 'function') {
      return globalThis.requestIdleCallback(cb, opts);
    }
    const timeout = (opts && opts.timeout) || 200;
    const start = Date.now();
    return setTimeout(
      () => cb({ timeRemaining: () => Math.max(0, 50 - (Date.now() - start)) }),
      timeout,
    );
  }

  function initDelayed() {
    idleCallbackWrapper(init, { timeout: 2000 });
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
      const earthReady =
        document.querySelector('#threeEarthContainer')?.dataset?.threeReady ===
        '1';
      if (document.querySelector('#threeEarthContainer') && !earthReady) {
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
    (function scheduleSmartForceHide(attempt = 1) {
      const DEFAULT_INITIAL_DELAY = 5000;
      const EXTENDED_INITIAL_DELAY = 8000; // give heavier modules (three-earth) more time on slower hosts
      const RETRY_DELAY = 5000;
      const MAX_ATTEMPTS = 3;

      // Compute delay dynamically in case heavier modules are still blocking
      const computeDelay = () => {
        try {
          if (
            typeof AppLoadManager !== 'undefined' &&
            typeof AppLoadManager.getPending === 'function'
          ) {
            const pending = AppLoadManager.getPending() || [];
            if (pending.includes('three-earth')) return EXTENDED_INITIAL_DELAY;
          }
        } catch {
          /* ignore and fall back to default */
        }
        return DEFAULT_INITIAL_DELAY;
      };

      const initialDelay = computeDelay();

      setTimeout(
        () => {
          if (windowLoaded) return;

          // If other modules registered as blocking, defer forced hide and retry
          try {
            // Ensure AppLoadManager exists and is callable before using it (some environments may not register it)
            if (
              typeof AppLoadManager !== 'undefined' &&
              typeof AppLoadManager.isBlocked === 'function' &&
              AppLoadManager.isBlocked?.()
            ) {
              const pending =
                typeof AppLoadManager.getPending === 'function'
                  ? AppLoadManager.getPending()
                  : [];
              log.warn(
                `Deferring forced loading screen hide (attempt ${attempt}): blocking modules=${
                  Array.isArray(pending) ? pending.join(', ') : String(pending)
                }`,
              );

              if (attempt < MAX_ATTEMPTS) {
                scheduleSmartForceHide(attempt + 1);
                return;
              }
              log.warn(
                'Max attempts reached - forcing hide despite blocking modules',
              );
            }
          } catch (e) {
            log.debug(
              'AppLoadManager not available or check failed (expected in some environments)',
              e,
            );
          }

          const pending =
            typeof AppLoadManager?.getPending === 'function'
              ? AppLoadManager.getPending()
              : [];
          log.info(
            'Forcing loading screen hide after timeout',
            pending.length ? { pendingModules: pending } : undefined,
          );
          // Force-hide now
          LoadingScreenManager.setStatus('Schließe Ladebildschirm...');
          LoadingScreenManager.hide();
        },
        attempt === 1 ? initialDelay : RETRY_DELAY,
      );
    })();

    schedulePersistentStorageRequest(2200);

    // Activate deferred styles that were marked with data-defer="1"
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
            /* ignore individual link errors */
          }
        });
      } catch {
        /* ignore */
      }
    };

    try {
      // Try activating now (covers case where links are already in DOM)
      activateDeferredStyles();

      // Ensure activation after DOM is parsed and on full load
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', activateDeferredStyles, {
          once: true,
        });
      } else {
        // In case script executed after parsing, ensure microtask activation
        setTimeout(activateDeferredStyles, 0);
      }
      globalThis.addEventListener('load', activateDeferredStyles);

      // Observe head for dynamically inserted deferred link elements
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
              /* ignore per-node errors */
            }
          }
        }
      });
      headObserver.observe(document.head || document.documentElement, {
        childList: true,
        subtree: true,
      });
      // Disconnect after full load to avoid long-running observers
      globalThis.addEventListener('load', () => headObserver.disconnect(), {
        once: true,
      });
    } catch {
      /* ignore overall activation errors */
    }

    // Delegated handlers for retry and share buttons to avoid inline handlers (CSP-compliant)
    const _onDocDelegatedClick = (event) => {
      const target = event.target;
      if (!target) return;

      // Retry / reload buttons (class-based)
      const retry = target?.closest('.retry-btn');
      if (retry) {
        event.preventDefault();
        try {
          globalThis.location.reload();
        } catch {
          // fallback - do nothing, reload failed
        }
        return;
      }

      // Share button (degraded to clipboard if navigator.share not available)
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
    // store ref for potential cleanup
    globalThis.__main_delegated_remove = _removeMainDelegated;

    log.info('Performance:', {
      domReady: Math.round(perfMarks.domReady - perfMarks.start),
      modulesReady: Math.round(perfMarks.modulesReady - perfMarks.start),
      windowLoaded: Math.round(perfMarks.windowLoaded - perfMarks.start),
    });

    // Dev-only ReconnectingWebSocket helper removed (was used for ?ws-test / local debug).
  },
  { once: true },
);

// ===== BFCache / Back Button Handling =====
// Ensure Three.js system is resilient when navigating back
globalThis.addEventListener('pageshow', (event) => {
  if (event.persisted) {
    log.info('Page restored from bfcache');
    // If we have a cleanup function, it means it was running.
    // If the browser froze the state, it might just resume.
    // However, we want to ensure interactions are active.

    // Force a resize event to re-calibrate camera/renderer
    globalThis.dispatchEvent(new CustomEvent('resize'));

    // Re-check visibility
    if (
      !document.hidden &&
      globalThis.threeEarthSystem &&
      globalThis.threeEarthSystem.animate
    ) {
      // If system exposed an animate function, we could call it, but the loop usually uses rAF
      // which might have been paused.
      // The visibilitychange handler should pick this up, but let's trigger it.
      document.dispatchEvent(new CustomEvent('visibilitychange'));
    }
  }
});
