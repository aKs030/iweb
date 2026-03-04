/**
 * View Transitions API - Progressive Enhancement
 *
 * Lightweight helper for wrapping DOM updates in View Transitions and
 * a safe same-page scroll interceptor for anchor links.
 *
 * @version 4.1.0
 */

import { handleSamePageScroll } from './utils.js';

let isInitialized = false;
let activeTransition = null;

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
  typeof ViewTransition !== 'undefined' &&
  typeof document?.startViewTransition === 'function';

/**
 * @param {unknown} error
 * @returns {boolean}
 */
const isAbortError = (error) =>
  !!error &&
  typeof error === 'object' &&
  'name' in error &&
  error.name === 'AbortError';

/**
 * @param {unknown} value
 * @returns {string[]}
 */
const normalizeTypes = (value) => {
  if (!Array.isArray(value)) return [];
  const unique = new Set();

  for (const entry of value) {
    if (typeof entry !== 'string') continue;
    const token = entry.trim();
    if (!token) continue;
    unique.add(token);
    if (unique.size >= 8) break;
  }

  return [...unique];
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
 * @returns {Promise<void>}
 */
const waitForActiveTransition = async () => {
  if (!activeTransition) return;
  try {
    await activeTransition;
  } catch {
    /* ignore previous transition failures */
  }
};

/**
 * @param {Promise<void>} finishedPromise
 */
const trackActiveTransition = (finishedPromise) => {
  const tracked = finishedPromise.finally(() => {
    if (activeTransition === tracked) {
      activeTransition = null;
    }
  });

  activeTransition = tracked;
  silencePromiseRejection(tracked);
};

/**
 * Wrap a DOM mutation in a View Transition if supported.
 * Calls are serialized so a new transition does not abort the previous one.
 *
 * @param {() => void|Promise<void>} callback
 * @param {{ types?: string[] }} [options]
 * @returns {Promise<void>}
 */
export async function withViewTransition(callback, options = {}) {
  if (typeof callback !== 'function') return;

  try {
    await waitForActiveTransition();

    if (!isSupported()) {
      await callback();
      return;
    }

    const types = normalizeTypes(options.types);
    let transition;
    let updateExecuted = false;

    const update = async () => {
      updateExecuted = true;
      await callback();
    };

    try {
      transition = startTransition(update, types);
    } catch {
      await callback();
      return;
    }

    guardTransitionPromises(transition);

    const finishedPromise = Promise.resolve(transition?.finished);
    trackActiveTransition(finishedPromise);

    try {
      if (types.length && transition?.types && transition.types.size === 0) {
        for (const token of types) transition.types.add(token);
      }

      await finishedPromise;
    } catch (error) {
      if (!updateExecuted && !isAbortError(error)) {
        await callback();
      }
    }
  } catch {
    /* keep transition helper non-throwing for fire-and-forget call sites */
  }
}

/**
 * @param {MouseEvent} event
 * @returns {HTMLAnchorElement|null}
 */
function getEventAnchor(event) {
  const path = event.composedPath?.() || [];

  for (const node of path) {
    if (node instanceof HTMLAnchorElement && node.hasAttribute('href')) {
      return node;
    }
  }

  const target = event.target;
  if (!(target instanceof Element)) return null;

  return target.closest('a[href]');
}

/**
 * @param {HTMLAnchorElement} link
 * @returns {boolean}
 */
function shouldIgnoreLink(link) {
  const href = link.getAttribute('href') || '';
  if (!href) return true;
  if (href.startsWith('#')) return true;
  if (href.startsWith('mailto:') || href.startsWith('tel:')) return true;
  if (href.startsWith('javascript:')) return true;
  if (link.hasAttribute('download')) return true;
  if (link.target && link.target !== '_self') return true;
  if (link.rel.includes('external')) return true;

  return false;
}

/**
 * Intercepts same-page links so scroll-to-top can be handled smoothly.
 *
 * @param {MouseEvent} event
 */
function onDocumentClick(event) {
  if (event.defaultPrevented) return;
  if (event.button !== 0) return;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

  const link = getEventAnchor(event);
  if (!link || shouldIgnoreLink(link)) return;

  if (handleSamePageScroll(link.href)) {
    event.preventDefault();
  }
}

/**
 * Initialize View Transitions support hooks.
 */
export function initViewTransitions() {
  if (isInitialized) return;
  isInitialized = true;
  document.addEventListener('click', onDocumentClick);
}
