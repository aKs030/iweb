import {
  OVERLAY_MODES,
  activeOverlay,
  normalizeOverlayMode,
} from './ui-store.js';
/** @typedef {import('./types.js').OverlayFocusResolverName} OverlayFocusResolverName */

const OVERLAY_TEMP_FOCUS_ATTR = 'data-overlay-manager-temp-focus';
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  'object',
  'embed',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/** @type {string} */
let currentFocusedOverlayMode = OVERLAY_MODES.NONE;
/**
 * @type {Map<string, {restoreFocus?: boolean}>}
 */
const pendingFocusChangeOptions = new Map();
/**
 * @type {{
 *   mode: string,
 *   roots: HTMLElement[],
 *   originFocus: HTMLElement|null,
 *   restoreFocus: boolean,
 *   abortController: AbortController|null,
 *   tempFocusElement: HTMLElement|null
 * }|null}
 */
let activeFocusSession = null;
/**
 * @typedef {Object} OverlayFocusSyncOptions
 * @property {(mode: string) => HTMLElement[]} getFocusTrapRootsForMode
 * @property {(mode: string, methodName: OverlayFocusResolverName) => HTMLElement|null} getControllerFocusElement
 */
/**
 * @typedef {Object} OverlayFocusTeardownOptions
 * @property {boolean} [restoreFocus]
 * @property {string} [mode]
 * @property {(mode: string, methodName: OverlayFocusResolverName) => HTMLElement|null} [getControllerFocusElement]
 */

function focusSafely(element) {
  if (
    !(element instanceof HTMLElement) ||
    typeof element.focus !== 'function'
  ) {
    return false;
  }

  try {
    element.focus({ preventScroll: true });
    return (
      document.activeElement === element || getDeepActiveElement() === element
    );
  } catch {
    // fallback below
  }

  try {
    element.focus();
    return (
      document.activeElement === element || getDeepActiveElement() === element
    );
  } catch {
    return false;
  }
}

function getDeepActiveElement() {
  if (typeof document === 'undefined') return null;

  /** @type {Element|null} */
  let active = document.activeElement;
  while (active instanceof HTMLElement && active.shadowRoot?.activeElement) {
    active = active.shadowRoot.activeElement;
  }

  return active instanceof HTMLElement ? active : null;
}

function getActiveRestorableElement() {
  const active = getDeepActiveElement();
  if (
    !active ||
    active === document.body ||
    active === document.documentElement ||
    !active.isConnected
  ) {
    return null;
  }

  return active;
}

function isVisibleFocusableElement(element) {
  if (!(element instanceof HTMLElement) || !element.isConnected) return false;
  if (element.hidden || element.inert) return false;
  if (element.getAttribute('aria-hidden') === 'true') return false;
  if ('disabled' in element && element.disabled) return false;

  const style = window.getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden') return false;

  return (
    element.getClientRects().length > 0 || getDeepActiveElement() === element
  );
}

function getFocusableElements(roots) {
  /** @type {HTMLElement[]} */
  const focusable = [];
  const seen = new Set();

  const pushFocusable = (element) => {
    if (!(element instanceof HTMLElement)) return;
    if (seen.has(element)) return;
    if (!isVisibleFocusableElement(element)) return;
    seen.add(element);
    focusable.push(element);
  };

  roots.forEach((root) => {
    if (!(root instanceof HTMLElement) || !root.isConnected) return;
    if (root.matches(FOCUSABLE_SELECTOR)) {
      pushFocusable(root);
    }

    root.querySelectorAll(FOCUSABLE_SELECTOR).forEach((element) => {
      pushFocusable(/** @type {HTMLElement} */ (element));
    });
  });

  return focusable;
}

function isElementWithinRoots(element, roots) {
  if (!(element instanceof HTMLElement)) return false;
  return roots.some(
    (root) =>
      root === element || root.contains(element) || element.contains(root),
  );
}

function cleanupTempFocusElement(session) {
  const element = session?.tempFocusElement;
  if (
    element instanceof HTMLElement &&
    element.getAttribute(OVERLAY_TEMP_FOCUS_ATTR) === 'true'
  ) {
    element.removeAttribute('tabindex');
    element.removeAttribute(OVERLAY_TEMP_FOCUS_ATTR);
  }

  if (session) {
    session.tempFocusElement = null;
  }
}

function focusOverlayElement(target, roots, session) {
  if (target instanceof HTMLElement && isVisibleFocusableElement(target)) {
    cleanupTempFocusElement(session);
    return focusSafely(target);
  }

  const fallbackRoot = roots.find(
    (root) => root instanceof HTMLElement && root.isConnected,
  );
  if (!(fallbackRoot instanceof HTMLElement)) return false;

  if (
    !fallbackRoot.hasAttribute('tabindex') &&
    fallbackRoot.getAttribute(OVERLAY_TEMP_FOCUS_ATTR) !== 'true'
  ) {
    fallbackRoot.setAttribute('tabindex', '-1');
    fallbackRoot.setAttribute(OVERLAY_TEMP_FOCUS_ATTR, 'true');
    session.tempFocusElement = fallbackRoot;
  }

  return focusSafely(fallbackRoot);
}

function scheduleOverlayInitialFocus(
  session,
  getControllerFocusElement,
  attempt = 0,
) {
  if (typeof requestAnimationFrame !== 'function') return;

  requestAnimationFrame(() => {
    if (activeFocusSession !== session) return;

    const focusTarget =
      getControllerFocusElement(session.mode, 'getPrimaryFocusTarget') ||
      getFocusableElements(session.roots)[0] ||
      null;
    const didFocus = focusOverlayElement(focusTarget, session.roots, session);

    if (!didFocus && attempt < 4) {
      scheduleOverlayInitialFocus(
        session,
        getControllerFocusElement,
        attempt + 1,
      );
    }
  });
}

function handleOverlayTrapTabKey(event, session) {
  if (event.key !== 'Tab' || activeFocusSession !== session) return;

  const focusable = getFocusableElements(session.roots);
  if (focusable.length === 0) {
    event.preventDefault();
    focusOverlayElement(null, session.roots, session);
    return;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = getDeepActiveElement();
  const activeInside = isElementWithinRoots(active, session.roots);

  if (event.shiftKey) {
    if (!activeInside || active === first) {
      event.preventDefault();
      focusSafely(last);
    }
    return;
  }

  if (!activeInside || active === last) {
    event.preventDefault();
    focusSafely(first);
  }
}

function handleOverlayTrapFocusIn(session, getControllerFocusElement) {
  if (activeFocusSession !== session) return;

  const active = getDeepActiveElement();
  if (!active || isElementWithinRoots(active, session.roots)) return;

  const fallbackTarget =
    getControllerFocusElement(session.mode, 'getPrimaryFocusTarget') ||
    getFocusableElements(session.roots)[0] ||
    null;
  focusOverlayElement(fallbackTarget, session.roots, session);
}

function setupFocusSession(
  mode,
  originFocus,
  getFocusTrapRootsForMode,
  getControllerFocusElement,
) {
  if (typeof document === 'undefined') return;

  const roots = getFocusTrapRootsForMode(mode);
  if (roots.length === 0) return;

  const abortController =
    typeof AbortController === 'function' ? new AbortController() : null;
  const session = {
    mode,
    roots,
    originFocus:
      originFocus || getControllerFocusElement(mode, 'getRestoreFocusTarget'),
    restoreFocus: true,
    abortController,
    tempFocusElement: null,
  };

  activeFocusSession = session;
  scheduleOverlayInitialFocus(session, getControllerFocusElement);

  document.addEventListener(
    'keydown',
    (event) => handleOverlayTrapTabKey(event, session),
    { capture: true, signal: abortController?.signal },
  );
  document.addEventListener(
    'focusin',
    () => handleOverlayTrapFocusIn(session, getControllerFocusElement),
    { capture: true, signal: abortController?.signal },
  );
}

/**
 * @param {OverlayFocusTeardownOptions} [options]
 * @returns {void}
 */
function teardownFocusSession({
  restoreFocus = false,
  mode = currentFocusedOverlayMode,
  getControllerFocusElement = () => null,
} = {}) {
  const session = activeFocusSession;
  if (!session) return;

  session.abortController?.abort();
  cleanupTempFocusElement(session);
  activeFocusSession = null;

  if (!restoreFocus) return;

  const originTarget = session.originFocus;
  const fallbackTarget = getControllerFocusElement(
    mode,
    'getRestoreFocusTarget',
  );

  requestAnimationFrame(() => {
    if (activeOverlay.value !== OVERLAY_MODES.NONE) return;
    if (
      originTarget instanceof HTMLElement &&
      originTarget.isConnected &&
      focusSafely(originTarget)
    ) {
      return;
    }

    if (fallbackTarget instanceof HTMLElement && fallbackTarget.isConnected) {
      focusSafely(fallbackTarget);
    }
  });
}

function consumePendingFocusChangeOptions(mode) {
  const normalizedMode = normalizeOverlayMode(mode);
  const options = pendingFocusChangeOptions.get(normalizedMode) || null;
  pendingFocusChangeOptions.delete(normalizedMode);
  return options;
}

export function prepareOverlayFocusChange(mode, options = {}) {
  const normalizedMode = normalizeOverlayMode(mode);
  if (
    normalizedMode === OVERLAY_MODES.NONE ||
    activeOverlay.value !== normalizedMode
  ) {
    return;
  }

  pendingFocusChangeOptions.set(normalizedMode, {
    restoreFocus: options.restoreFocus !== false,
  });
}

/**
 * @param {string} mode
 * @param {OverlayFocusSyncOptions} options
 * @returns {void}
 */
export function syncOverlayFocusState(
  mode,
  { getFocusTrapRootsForMode, getControllerFocusElement },
) {
  const normalizedMode = normalizeOverlayMode(mode);
  if (normalizedMode === currentFocusedOverlayMode) return;

  const previousMode = currentFocusedOverlayMode;
  const nextOriginFocus =
    normalizedMode === OVERLAY_MODES.NONE ? null : getActiveRestorableElement();
  const previousFocusOptions =
    previousMode === OVERLAY_MODES.NONE
      ? null
      : consumePendingFocusChangeOptions(previousMode);

  if (previousMode !== OVERLAY_MODES.NONE) {
    teardownFocusSession({
      mode: previousMode,
      restoreFocus:
        normalizedMode === OVERLAY_MODES.NONE &&
        previousFocusOptions?.restoreFocus !== false,
      getControllerFocusElement,
    });
  }

  currentFocusedOverlayMode = normalizedMode;
  pendingFocusChangeOptions.delete(normalizedMode);

  if (normalizedMode !== OVERLAY_MODES.NONE) {
    setupFocusSession(
      normalizedMode,
      nextOriginFocus,
      getFocusTrapRootsForMode,
      getControllerFocusElement,
    );
  }
}

/**
 * @param {(mode: string, methodName: OverlayFocusResolverName) => HTMLElement|null} getControllerFocusElement
 * @returns {void}
 */
export function destroyOverlayFocus(getControllerFocusElement) {
  if (currentFocusedOverlayMode !== OVERLAY_MODES.NONE) {
    teardownFocusSession({ restoreFocus: false, getControllerFocusElement });
    currentFocusedOverlayMode = OVERLAY_MODES.NONE;
  }

  pendingFocusChangeOptions.clear();
}
