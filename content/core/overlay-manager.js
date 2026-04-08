import { effect } from './signals.js';
import {
  OVERLAY_MODES,
  activeOverlay,
  clearActiveOverlayMode,
  normalizeOverlayMode,
} from './ui-store.js';
import {
  clearOverlayControllers,
  deleteOverlayController,
  destroyBackdrop,
  ensureBackdropElement,
  getControllerFocusElement,
  getControllerRoots,
  getGlobalBackdropElement as getBackdropElement,
  getOverlayController,
  setOverlayController,
  shouldModeShowBackdrop,
  syncBackdropState,
  syncBackgroundInteractivity,
  syncBodyOverlayState,
} from './overlay-core.js';
import {
  destroyOverlayFocus,
  prepareOverlayFocusChange,
  syncOverlayFocusState,
} from './overlay-focus.js';
/** @typedef {import('./types.js').OverlayController} OverlayController */

export { OVERLAY_MODES } from './ui-store.js';

/** @type {Map<string, string[]>} */
const DEFAULT_INTERACTIVE_ROOT_SELECTORS = new Map([
  [OVERLAY_MODES.MENU, ['header.site-header', 'site-menu']],
  [OVERLAY_MODES.SEARCH, ['header.site-header', 'site-menu']],
  [
    OVERLAY_MODES.ROBOT_CHAT,
    ['#robot-chat-window', '#robot-companion-container'],
  ],
]);

/** @type {(() => void)|null} */
let overlaySyncCleanup = null;

/**
 * @param {Element|null} element
 * @returns {element is HTMLElement}
 */
function isConnectedHTMLElement(element) {
  return element instanceof HTMLElement && element.isConnected;
}

function getDefaultInteractiveRoots(mode) {
  if (typeof document === 'undefined') return [];

  const selectors = DEFAULT_INTERACTIVE_ROOT_SELECTORS.get(
    normalizeOverlayMode(mode),
  );
  if (!selectors?.length) return [];

  return selectors
    .map((selector) => document.querySelector(selector))
    .filter(isConnectedHTMLElement);
}

function getInteractiveRootsForMode(mode) {
  const normalizedMode = normalizeOverlayMode(mode);
  const controllerRoots = getControllerRoots(
    normalizedMode,
    'getInteractiveRoots',
  );
  const roots =
    controllerRoots.length > 0
      ? controllerRoots
      : getDefaultInteractiveRoots(normalizedMode);

  if (shouldModeShowBackdrop(normalizedMode)) {
    const backdrop = ensureBackdropElement();
    if (backdrop) roots.push(backdrop);
  }

  return [...new Set(roots)];
}

function getFocusTrapRootsForMode(mode) {
  return getControllerRoots(
    mode,
    'getFocusTrapRoots',
    getInteractiveRootsForMode(mode),
  );
}

function syncOverlayEnvironment(mode) {
  syncBodyOverlayState(mode);
  syncBackdropState(mode);
  syncBackgroundInteractivity(mode, { getInteractiveRootsForMode });
  syncOverlayFocusState(mode, {
    getFocusTrapRootsForMode,
    getControllerFocusElement,
  });
}

export function getGlobalBackdropElement() {
  return getBackdropElement();
}

export { prepareOverlayFocusChange };

/**
 * @param {string} mode
 * @param {OverlayController} [controller]
 * @returns {() => void}
 */
export function registerOverlayController(mode, controller = {}) {
  const normalizedMode = normalizeOverlayMode(mode);
  if (normalizedMode === OVERLAY_MODES.NONE) {
    return () => {};
  }

  setOverlayController(normalizedMode, controller);
  syncBackgroundInteractivity(activeOverlay.value, {
    getInteractiveRootsForMode,
  });

  return () => {
    deleteOverlayController(normalizedMode, controller);
    syncBackgroundInteractivity(activeOverlay.value, {
      getInteractiveRootsForMode,
    });
  };
}

export async function closeActiveOverlay(options = {}) {
  const normalizedMode = normalizeOverlayMode(activeOverlay.value);
  if (normalizedMode === OVERLAY_MODES.NONE) {
    return false;
  }

  const controller = getOverlayController(normalizedMode);
  if (typeof controller?.close === 'function') {
    await Promise.resolve(
      controller.close({
        mode: normalizedMode,
        reason: String(options.reason || 'programmatic'),
        restoreFocus: options.restoreFocus !== false,
      }),
    );
  } else {
    clearActiveOverlayMode(normalizedMode);
  }

  return true;
}

export function initOverlayManager() {
  if (overlaySyncCleanup || typeof document === 'undefined') {
    return overlaySyncCleanup;
  }

  overlaySyncCleanup = effect(() => {
    syncOverlayEnvironment(normalizeOverlayMode(activeOverlay.value));
  });

  return overlaySyncCleanup;
}

export function destroyOverlayManager() {
  if (overlaySyncCleanup) {
    overlaySyncCleanup();
    overlaySyncCleanup = null;
  }

  if (typeof document !== 'undefined' && document.body) {
    syncBodyOverlayState(OVERLAY_MODES.NONE);
    delete document.body.dataset.activeOverlay;
    if (document.documentElement instanceof HTMLElement) {
      delete document.documentElement.dataset.activeOverlay;
    }
    syncBackgroundInteractivity(OVERLAY_MODES.NONE, {
      getInteractiveRootsForMode,
    });
  }

  destroyOverlayFocus(getControllerFocusElement);
  destroyBackdrop();
  clearOverlayControllers();
}
