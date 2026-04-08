import {
  BACKDROP_SENSITIVE_TRANSITION_TYPES,
  VIEW_TRANSITION_TIMINGS_MS,
} from './view-transition-constants.js';

const MAX_TOKEN_COUNT = 8;
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const MOBILE_MENU_QUERY = '(max-width: 900px)';
const MENU_HOST_SELECTOR = 'site-menu';
const MENU_PANEL_SELECTOR = '.site-menu';
const DEBUG_FLAG = '__VT_DEBUG__';
const BACKDROP_SENSITIVE_TYPES = new Set(BACKDROP_SENSITIVE_TRANSITION_TYPES);

const VT_EVENTS = Object.freeze({
  START: 'viewtransition:start',
  FINISH: 'viewtransition:finish',
  ERROR: 'viewtransition:error',
});

/** @type {Promise<void>} */
let transitionQueue = Promise.resolve();
/** @type {MediaQueryList|null} */
let reducedMotionMql = null;
/** @type {(() => void)|null} */
let reducedMotionCleanup = null;
let prefersReducedMotion = false;

/**
 * @typedef {Object} TransitionOptions
 * @property {string[]=} types - Typed transition labels
 * @property {string[]=} rootClasses - Temporary classes on <html> while transition is active
 * @property {boolean=} force - Bypass reduced-motion/visibility guards
 * @property {boolean=} respectReducedMotion - Defaults to true
 * @property {number=} timeoutMs - Soft timeout before skipTransition() is attempted
 * @property {AbortSignal=} signal - Optional external cancellation
 * @property {boolean=} preserveLiveBackdropOnMobile - Defaults to true; skips capture-prone types on small screens
 */

/**
 * @returns {boolean}
 */
export const isSupported = () =>
  typeof document !== 'undefined' &&
  typeof document.startViewTransition === 'function';

/**
 * @returns {boolean}
 */
const supportsTypedTransitions = () =>
  isSupported() && typeof ViewTransition !== 'undefined';

/**
 * @param {unknown} value
 * @returns {boolean}
 */
const isTruthyValue = (value) => {
  const token = String(value ?? '')
    .trim()
    .toLowerCase();
  return token === '1' || token === 'true' || token === 'yes' || token === 'on';
};

/**
 * Debug switch:
 * - runtime: `window.__VT_DEBUG__ = true`
 * - query param: `?vt_debug=1`
 *
 * @returns {boolean}
 */
const isViewTransitionDebugEnabled = () => {
  const runtimeFlag =
    typeof globalThis !== 'undefined' ? globalThis[DEBUG_FLAG] : undefined;
  if (isTruthyValue(runtimeFlag)) return true;

  try {
    const params = new URLSearchParams(globalThis.location?.search || '');
    if (isTruthyValue(params.get('vt_debug'))) {
      return true;
    }
  } catch {
    /* ignore URL parsing/runtime restrictions */
  }

  return false;
};

/**
 * @param {string} message
 * @param {Record<string, unknown>} [detail]
 */
export const debugViewTransition = (message, detail = {}) => {
  if (!isViewTransitionDebugEnabled()) return;
  try {
    console.debug('[view-transitions]', message, detail);
  } catch {
    /* noop */
  }
};

/**
 * @param {string} query
 * @returns {MediaQueryList|null}
 */
const getMediaQueryList = (query) => {
  if (typeof globalThis.matchMedia === 'function') {
    return globalThis.matchMedia(query);
  }
  if (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function'
  ) {
    return window.matchMedia(query);
  }
  return null;
};

/**
 * @param {unknown} error
 * @returns {boolean}
 */
const isAbortError = (error) =>
  !!error &&
  typeof error === 'object' &&
  'name' in error &&
  (error.name === 'AbortError' || error.name === 'TimeoutError');

/**
 * @param {unknown} error
 * @returns {string}
 */
const getErrorMessage = (error) =>
  error && typeof error === 'object' && 'message' in error
    ? String(error.message)
    : String(error);

/**
 * @param {ViewTransition|undefined} transition
 */
const skipTransitionSafely = (transition) => {
  try {
    transition?.skipTransition?.();
  } catch {
    /* noop */
  }
};

/**
 * @param {unknown} value
 * @param {number} [maxCount]
 * @returns {string[]}
 */
const normalizeTokens = (value, maxCount = MAX_TOKEN_COUNT) => {
  if (!Array.isArray(value)) return [];
  const unique = new Set();

  for (const entry of value) {
    if (typeof entry !== 'string') continue;
    const token = entry.trim().toLowerCase();
    if (!token) continue;
    if (!/^[a-z0-9_-]{1,48}$/i.test(token)) continue;
    unique.add(token);
    if (unique.size >= maxCount) break;
  }

  return [...unique];
};

/**
 * @param {unknown} value
 * @returns {string[]}
 */
export const normalizeTypes = (value) => normalizeTokens(value);

/**
 * @param {unknown} value
 * @returns {string[]}
 */
export const normalizeClassTokens = (value) => normalizeTokens(value);

/**
 * @param {unknown} value
 * @returns {number}
 */
export const normalizeTimeout = (value) => {
  const timeout = Number(value);
  if (!Number.isFinite(timeout) || timeout <= 0) {
    return VIEW_TRANSITION_TIMINGS_MS.DEFAULT_TIMEOUT;
  }
  return Math.max(250, Math.min(Math.round(timeout), 20000));
};

/**
 * @param {Promise<unknown>|undefined|null} promise
 */
const silencePromiseRejection = (promise) => {
  promise?.catch(() => {});
};

/**
 * @param {ViewTransition|undefined} transition
 */
const guardTransitionPromises = (transition) => {
  silencePromiseRejection(transition?.ready);
  silencePromiseRejection(transition?.updateCallbackDone);
};

/**
 * @returns {void}
 */
const ensureReducedMotionObserver = () => {
  if (reducedMotionMql) return;
  const mql = getMediaQueryList(REDUCED_MOTION_QUERY);
  if (!mql) return;

  prefersReducedMotion = !!mql.matches;
  reducedMotionMql = mql;

  const onChange = (event) => {
    prefersReducedMotion = !!event.matches;
  };

  if (typeof mql.addEventListener === 'function') {
    mql.addEventListener('change', onChange);
    reducedMotionCleanup = () => mql.removeEventListener('change', onChange);
  }
};

/**
 * @param {TransitionOptions} options
 * @returns {boolean}
 */
const shouldUseTransitions = (options) => {
  if (!isSupported()) return false;
  if (options.force) return true;

  ensureReducedMotionObserver();

  if (options.respectReducedMotion !== false && prefersReducedMotion) {
    return false;
  }

  if (document.hidden) return false;
  return true;
};

/**
 * @returns {boolean}
 */
const isMobileViewport = () => {
  const mql = getMediaQueryList(MOBILE_MENU_QUERY);
  if (!mql) return false;
  return !!mql.matches;
};

/**
 * @param {string} value
 * @returns {boolean}
 */
const isNoneBackdropFilter = (value) => {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();

  if (!normalized || normalized === 'none') return true;
  return /^blur\(\s*0(?:px)?\s*\)$/.test(normalized);
};

/**
 * @param {CSSStyleDeclaration} style
 * @returns {boolean}
 */
const hasActiveBackdropEffect = (style) => {
  const standard = style.backdropFilter || '';
  const webkit =
    /** @type {{ webkitBackdropFilter?: string }} */ (style)
      .webkitBackdropFilter || '';
  return !isNoneBackdropFilter(standard) || !isNoneBackdropFilter(webkit);
};

/**
 * @returns {HTMLElement[]}
 */
const getMenuPanels = () => {
  if (typeof document === 'undefined') return [];

  /** @type {Set<HTMLElement>} */
  const panels = new Set();

  document.querySelectorAll(MENU_PANEL_SELECTOR).forEach((node) => {
    if (node instanceof HTMLElement) panels.add(node);
  });

  document.querySelectorAll(MENU_HOST_SELECTOR).forEach((host) => {
    const root = host.shadowRoot || host;
    const panel = root.querySelector(MENU_PANEL_SELECTOR);
    if (panel instanceof HTMLElement) panels.add(panel);
  });

  return [...panels];
};

/**
 * @param {(style: CSSStyleDeclaration) => boolean} predicate
 * @returns {boolean}
 */
const anyMenuPanelStyleMatches = (predicate) => {
  if (typeof globalThis.getComputedStyle !== 'function') return false;
  for (const panel of getMenuPanels()) {
    const style = globalThis.getComputedStyle(panel);
    if (predicate(style)) return true;
  }
  return false;
};

/**
 * @returns {boolean}
 */
const isMenuDrawerLayoutActive = () => {
  return anyMenuPanelStyleMatches((style) => style.position === 'fixed');
};

/**
 * @returns {boolean}
 */
const hasMenuBackdropGlassActive = () => {
  return anyMenuPanelStyleMatches((style) => hasActiveBackdropEffect(style));
};

/**
 * ViewTransition snapshots can flatten backdrop-filter effects. For menu/search
 * glass overlays we keep the live DOM path on sensitive layouts.
 *
 * @param {string[]} types
 * @param {TransitionOptions} options
 * @returns {boolean}
 */
const shouldSkipForLiveBackdrop = (types, options) => {
  if (!types.length) return false;
  if (options.force) return false;
  if (options.preserveLiveBackdropOnMobile === false) return false;
  if (
    !types.some((type) =>
      BACKDROP_SENSITIVE_TYPES.has(/** @type {any} */ (type)),
    )
  ) {
    return false;
  }

  if (isMobileViewport()) return true;
  if (isMenuDrawerLayoutActive()) return true;
  if (hasMenuBackdropGlassActive()) return true;

  return false;
};

/**
 * @param {() => void|Promise<void>} update
 * @param {string[]} types
 * @returns {ViewTransition}
 */
const startTransition = (update, types) => {
  if (types.length && supportsTypedTransitions()) {
    return document.startViewTransition({
      update,
      types,
    });
  }

  return document.startViewTransition(update);
};

/**
 * Serializes transitions to avoid AbortError races when multiple callers
 * trigger mutations in the same microtask window.
 *
 * @param {() => Promise<void>} task
 * @returns {Promise<void>}
 */
const runInTransitionQueue = async (task) => {
  const queuedTask = transitionQueue.then(task, task);
  transitionQueue = queuedTask.catch(() => {});
  await queuedTask;
};

/**
 * @param {Promise<void>} promise
 * @param {number} timeoutMs
 * @param {() => void} onTimeout
 * @returns {Promise<void>}
 */
const withTimeout = (promise, timeoutMs, onTimeout) => {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return promise;

  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      try {
        onTimeout();
      } catch {
        /* noop */
      }
      const timeoutError = new Error('View transition timed out.');
      timeoutError.name = 'TimeoutError';
      reject(timeoutError);
    }, timeoutMs);

    Promise.resolve(promise)
      .then(() => resolve())
      .catch(reject)
      .finally(() => clearTimeout(timeoutId));
  });
};

/**
 * @param {string[]} classTokens
 * @returns {() => void}
 */
const applyRootClasses = (classTokens) => {
  if (!classTokens.length || !document.documentElement) return () => {};
  document.documentElement.classList.add(...classTokens);
  return () => document.documentElement.classList.remove(...classTokens);
};

/**
 * @param {string} eventName
 * @param {Record<string, unknown>} detail
 */
const dispatchTransitionEvent = (eventName, detail) => {
  try {
    document.dispatchEvent(new CustomEvent(eventName, { detail }));
  } catch {
    /* keep helper non-throwing */
  }
};

/**
 * Wrap a DOM mutation in a View Transition if supported.
 * Calls are serialized so a new transition does not abort the previous one.
 *
 * @param {() => void|Promise<void>} callback
 * @param {TransitionOptions} [options]
 * @returns {Promise<void>}
 */
export async function withViewTransition(callback, options = {}) {
  if (typeof callback !== 'function') return;

  await runInTransitionQueue(async () => {
    try {
      if (options.signal?.aborted) {
        debugViewTransition('skip:aborted-signal', {});
        await callback();
        return;
      }

      const types = normalizeTypes(options.types);

      if (shouldSkipForLiveBackdrop(types, options)) {
        debugViewTransition('skip:live-backdrop', { types });
        await callback();
        return;
      }

      if (!shouldUseTransitions(options)) {
        debugViewTransition('skip:transitions-disabled', { types });
        await callback();
        return;
      }

      const rootClasses = normalizeClassTokens(options.rootClasses);
      const cleanupRootClasses = applyRootClasses(rootClasses);
      const timeoutMs = normalizeTimeout(options.timeoutMs);

      let transition;
      let updateExecuted = false;

      const update = async () => {
        if (options.signal?.aborted) return;
        updateExecuted = true;
        await callback();
      };

      try {
        transition = startTransition(update, types);
      } catch (error) {
        cleanupRootClasses();
        debugViewTransition('fallback:start-failed', {
          types,
          message: getErrorMessage(error),
        });
        await callback();
        return;
      }

      debugViewTransition('start', { types, timeoutMs, rootClasses });

      guardTransitionPromises(transition);

      const finishedPromise = Promise.resolve(transition?.finished);
      silencePromiseRejection(finishedPromise);

      if (types.length && transition?.types && transition.types.size === 0) {
        for (const token of types) {
          transition.types.add(token);
        }
      }

      if (options.signal) {
        options.signal.addEventListener(
          'abort',
          () => skipTransitionSafely(transition),
          { once: true },
        );
      }

      dispatchTransitionEvent(VT_EVENTS.START, {
        types,
        ts: Date.now(),
      });

      try {
        await withTimeout(finishedPromise, timeoutMs, () =>
          skipTransitionSafely(transition),
        );

        dispatchTransitionEvent(VT_EVENTS.FINISH, {
          types,
          ts: Date.now(),
        });
        debugViewTransition('finish', { types });
      } catch (error) {
        const message = getErrorMessage(error);
        dispatchTransitionEvent(VT_EVENTS.ERROR, {
          types,
          ts: Date.now(),
          message,
        });
        debugViewTransition('error', {
          types,
          message,
        });

        if (!updateExecuted && !isAbortError(error)) {
          await callback();
        }
      } finally {
        cleanupRootClasses();
      }
    } catch {
      /* keep transition helper non-throwing for fire-and-forget call sites */
    }
  });
}

/**
 * Temporarily applies an inline view-transition-name to an element while a
 * transition callback runs, then restores the previous inline value.
 *
 * @param {Element|null|undefined} element
 * @param {string} name
 * @param {() => void|Promise<void>} callback
 * @param {TransitionOptions} [options]
 * @returns {Promise<void>}
 */
export async function withElementViewTransitionName(
  element,
  name,
  callback,
  options = {},
) {
  const token = normalizeTokens([name], 1)[0];

  if (!(element instanceof HTMLElement) || !token) {
    await withViewTransition(callback, options);
    return;
  }

  const previousInlineName = element.style.viewTransitionName;
  element.style.viewTransitionName = token;

  try {
    await withViewTransition(callback, options);
  } finally {
    if (previousInlineName) {
      element.style.viewTransitionName = previousInlineName;
    } else {
      element.style.removeProperty('view-transition-name');
    }
  }
}

export const destroyViewTransitionCore = () => {
  if (reducedMotionCleanup) {
    reducedMotionCleanup();
    reducedMotionCleanup = null;
  }
  reducedMotionMql = null;
  prefersReducedMotion = false;
  transitionQueue = Promise.resolve();
};
