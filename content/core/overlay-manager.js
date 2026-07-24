import { effect } from "./signals.js";
import {
  OVERLAY_MODES,
  activeOverlay,
  commitActiveOverlay,
  normalizeOverlayMode,
} from "./state/overlay-state.js";
import {
  deleteOverlayController,
  ensureBackdropElement,
  getControllerFocusElement,
  getControllerRoots,
  getOverlayController,
  setOverlayController,
  shouldModeShowBackdrop,
  syncBackdropState,
  syncBackgroundInteractivity,
  syncBodyOverlayState,
  prepareOverlayFocusChange,
  syncOverlayFocusState,
} from "./overlay/index.js";
/** @typedef {import('./types.js').OverlayController} OverlayController */

export { OVERLAY_MODES } from "./state/overlay-state.js";

/** @type {Map<string, string[]>} */
const DEFAULT_INTERACTIVE_ROOT_SELECTORS = new Map([
  [OVERLAY_MODES.MENU, ["header.site-header", "site-menu"]],
  [OVERLAY_MODES.SEARCH, ["header.site-header", "site-menu"]],
  [OVERLAY_MODES.ROBOT_CHAT, ["#robot-chat-window", "#robot-companion-container"]],
  [OVERLAY_MODES.FOOTER, ["site-footer"]],
]);

/** @type {(() => void)|null} */
let overlaySyncCleanup = null;
let overlayOperationQueue = Promise.resolve();

function enqueueOverlayOperation(operation) {
  const queuedOperation = overlayOperationQueue.then(operation, operation);
  overlayOperationQueue = queuedOperation.catch(() => {});
  return queuedOperation;
}

/**
 * @param {Element|null} element
 * @returns {element is HTMLElement}
 */
function isConnectedHTMLElement(element) {
  return element instanceof HTMLElement && element.isConnected;
}

function getDefaultInteractiveRoots(mode) {
  if (typeof document === "undefined") return [];

  const selectors = DEFAULT_INTERACTIVE_ROOT_SELECTORS.get(normalizeOverlayMode(mode));
  if (!selectors?.length) return [];

  return selectors.map(selector => document.querySelector(selector)).filter(isConnectedHTMLElement);
}

function getInteractiveRootsForMode(mode) {
  const normalizedMode = normalizeOverlayMode(mode);
  const controllerRoots = getControllerRoots(normalizedMode, "getInteractiveRoots");
  const roots =
    controllerRoots.length > 0 ? controllerRoots : getDefaultInteractiveRoots(normalizedMode);

  if (shouldModeShowBackdrop(normalizedMode)) {
    const backdrop = ensureBackdropElement();
    if (backdrop) roots.push(backdrop);
  }

  return [...new Set(roots)];
}

function getFocusTrapRootsForMode(mode) {
  return getControllerRoots(mode, "getFocusTrapRoots", getInteractiveRootsForMode(mode));
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

/**
 * @param {string} mode
 * @param {{ reason?: string, restoreFocus?: boolean }} [options]
 * @returns {Promise<boolean>}
 */
async function performCloseOverlay(mode, options = {}) {
  const normalizedMode = normalizeOverlayMode(mode);
  if (
    normalizedMode === OVERLAY_MODES.NONE ||
    normalizeOverlayMode(activeOverlay.value) !== normalizedMode
  ) {
    return false;
  }

  prepareOverlayFocusChange(normalizedMode, {
    restoreFocus: options.restoreFocus !== false,
  });

  const controller = getOverlayController(normalizedMode);
  if (typeof controller?.close === "function") {
    await Promise.resolve(
      controller.close({
        mode: normalizedMode,
        reason: String(options.reason || "programmatic"),
        restoreFocus: options.restoreFocus !== false,
      })
    );
  }

  if (normalizeOverlayMode(activeOverlay.value) === normalizedMode) {
    commitActiveOverlay(OVERLAY_MODES.NONE);
  }

  return true;
}

/**
 * Opens one registered overlay and closes any previously active overlay first.
 * This is the only public entry point that activates an overlay mode.
 *
 * @param {string} mode
 * @param {{ reason?: string, restoreFocus?: boolean }} [options]
 * @returns {Promise<boolean>}
 */
async function performOpenOverlay(mode, options = {}) {
  const normalizedMode = normalizeOverlayMode(mode);
  if (normalizedMode === OVERLAY_MODES.NONE) return false;
  if (normalizeOverlayMode(activeOverlay.value) === normalizedMode) return true;

  const controller = getOverlayController(normalizedMode);
  if (typeof controller?.open !== "function") return false;

  const previousMode = normalizeOverlayMode(activeOverlay.value);
  if (previousMode !== OVERLAY_MODES.NONE) {
    await performCloseOverlay(previousMode, {
      reason: "overlay-replaced",
      restoreFocus: false,
    });
  }

  const actionOptions = {
    mode: normalizedMode,
    reason: String(options.reason || "programmatic"),
    restoreFocus: options.restoreFocus !== false,
  };

  if (typeof controller.prepareOpen === "function") {
    await Promise.resolve(controller.prepareOpen(actionOptions));
  }

  const openResult = controller.open(actionOptions);
  commitActiveOverlay(normalizedMode);
  await Promise.resolve(openResult);
  return true;
}

export function openOverlay(mode, options = {}) {
  return enqueueOverlayOperation(() => performOpenOverlay(mode, options));
}

/**
 * Closes the requested overlay, or the currently active overlay when omitted.
 *
 * @param {string|null} [mode]
 * @param {{ reason?: string, restoreFocus?: boolean }} [options]
 * @returns {Promise<boolean>}
 */
export function closeOverlay(mode = null, options = {}) {
  return enqueueOverlayOperation(() => {
    const normalizedMode = normalizeOverlayMode(mode ?? activeOverlay.value);
    return performCloseOverlay(normalizedMode, options);
  });
}

/**
 * Toggles one overlay using the centralized active mode as the source of truth.
 *
 * @param {string} mode
 * @param {{ reason?: string, restoreFocus?: boolean }} [options]
 * @returns {Promise<boolean>}
 */
export function toggleOverlay(mode, options = {}) {
  const normalizedMode = normalizeOverlayMode(mode);
  if (normalizedMode === OVERLAY_MODES.NONE) return Promise.resolve(false);

  return enqueueOverlayOperation(() => {
    if (normalizeOverlayMode(activeOverlay.value) === normalizedMode) {
      return performCloseOverlay(normalizedMode, {
        ...options,
        reason: String(options.reason || "toggle"),
      });
    }

    return performOpenOverlay(normalizedMode, {
      ...options,
      reason: String(options.reason || "toggle"),
    });
  });
}

export function initOverlayManager() {
  if (overlaySyncCleanup || typeof document === "undefined") {
    return overlaySyncCleanup;
  }

  overlaySyncCleanup = effect(() => {
    syncOverlayEnvironment(normalizeOverlayMode(activeOverlay.value));
  });

  return overlaySyncCleanup;
}
