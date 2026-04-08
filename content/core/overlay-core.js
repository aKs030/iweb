/**
 * Overlay Core - Centralized backdrop, isolation, and registry
 * @version 2.0.0
 */

import { OVERLAY_MODES, normalizeOverlayMode } from './ui-store.js';

/** @typedef {import('./types.js').OverlayController} OverlayController */
/** @typedef {import('./types.js').OverlayMode} OverlayMode */
/** @typedef {import('./types.js').OverlayRootResolverName} OverlayRootResolverName */
/** @typedef {import('./types.js').OverlayFocusResolverName} OverlayFocusResolverName */

// ============================================================================
// BACKDROP
// ============================================================================

export const GLOBAL_BACKDROP_ID = 'menu-global-backdrop';

const GLOBAL_BACKDROP_CLASS =
  'menu-global-backdrop overlay-backdrop overlay-backdrop--global';

/** @type {Set<OverlayMode>} */
const BACKDROP_VISIBLE_MODES = new Set([
  OVERLAY_MODES.MENU,
  OVERLAY_MODES.SEARCH,
  OVERLAY_MODES.ROBOT_CHAT,
]);

/** @type {HTMLElement|null} */
let backdropElement = null;
/** @type {{ scrollY: number, style: Record<string, string> }|null} */
let bodyScrollLockState = null;

export function shouldModeShowBackdrop(mode) {
  return BACKDROP_VISIBLE_MODES.has(normalizeOverlayMode(mode));
}

export function ensureBackdropElement() {
  if (typeof document === 'undefined' || !document.body) return null;
  if (backdropElement?.isConnected) return backdropElement;

  const existing = document.getElementById(GLOBAL_BACKDROP_ID);
  if (existing instanceof HTMLElement) {
    backdropElement = existing;
    return backdropElement;
  }

  const element = document.createElement('div');
  element.id = GLOBAL_BACKDROP_ID;
  element.className = GLOBAL_BACKDROP_CLASS;
  element.setAttribute('aria-hidden', 'true');
  document.body.appendChild(element);
  backdropElement = element;
  return backdropElement;
}

function shouldLockBodyScroll(mode) {
  const normalizedMode = normalizeOverlayMode(mode);
  if (
    normalizedMode === OVERLAY_MODES.SEARCH ||
    normalizedMode === OVERLAY_MODES.ROBOT_CHAT
  ) {
    return true;
  }

  if (normalizedMode === OVERLAY_MODES.MENU) {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(max-width: 900px)').matches;
  }

  return false;
}

function lockBodyScroll() {
  if (
    typeof document === 'undefined' ||
    !document.body ||
    bodyScrollLockState
  ) {
    return;
  }

  const body = document.body;
  const scrollY =
    typeof window !== 'undefined'
      ? window.scrollY || window.pageYOffset || 0
      : 0;

  bodyScrollLockState = {
    scrollY,
    style: {
      position: body.style.position || '',
      top: body.style.top || '',
      left: body.style.left || '',
      right: body.style.right || '',
      width: body.style.width || '',
      overflow: body.style.overflow || '',
    },
  };

  body.style.position = 'fixed';
  body.style.top = `-${scrollY}px`;
  body.style.left = '0';
  body.style.right = '0';
  body.style.width = '100%';
  body.style.overflow = 'hidden';
  body.dataset.overlayScrollLocked = 'true';
}

function unlockBodyScroll() {
  if (
    typeof document === 'undefined' ||
    !document.body ||
    !bodyScrollLockState
  ) {
    return;
  }

  const body = document.body;
  const { scrollY, style } = bodyScrollLockState;

  body.style.position = style.position;
  body.style.top = style.top;
  body.style.left = style.left;
  body.style.right = style.right;
  body.style.width = style.width;
  body.style.overflow = style.overflow;
  delete body.dataset.overlayScrollLocked;
  bodyScrollLockState = null;

  if (typeof window !== 'undefined') {
    window.scrollTo(0, Math.max(0, Number(scrollY) || 0));
  }
}

export function syncBodyOverlayState(mode) {
  if (typeof document === 'undefined' || !document.body) return;
  const normalizedMode = normalizeOverlayMode(mode);
  document.body.dataset.activeOverlay = normalizedMode;

  const root = document.documentElement;
  if (root instanceof HTMLElement) {
    root.dataset.activeOverlay = normalizedMode;
  }

  if (shouldLockBodyScroll(normalizedMode)) {
    lockBodyScroll();
  } else {
    unlockBodyScroll();
  }
}

export function syncBackdropState(mode) {
  const normalizedMode = normalizeOverlayMode(mode);
  const hasExistingBackdrop = Boolean(backdropElement?.isConnected);
  const needsBackdrop =
    shouldModeShowBackdrop(normalizedMode) || hasExistingBackdrop;

  if (!needsBackdrop) return;

  const backdrop = ensureBackdropElement();
  if (!backdrop) return;

  const isOpen = shouldModeShowBackdrop(normalizedMode);
  backdrop.classList.toggle('is-open', isOpen);
  backdrop.dataset.mode = normalizedMode;
}

export function getGlobalBackdropElement() {
  return ensureBackdropElement();
}

export function destroyBackdrop() {
  if (backdropElement?.isConnected) {
    backdropElement.remove();
  }
  backdropElement = null;
}

// ============================================================================
// ISOLATION
// ============================================================================

const OVERLAY_INERT_ATTR = 'data-overlay-manager-inert';
const BODY_CHILD_EXEMPT_SELECTOR = [
  `#${GLOBAL_BACKDROP_ID}`,
  '#live-region-status',
  '#live-region-assertive',
  '[aria-live]',
  '[data-overlay-inert-exempt]',
].join(', ');

function isBodyChildExempt(element) {
  return Boolean(
    element instanceof HTMLElement &&
    element.matches(BODY_CHILD_EXEMPT_SELECTOR),
  );
}

function shouldKeepBodyChildInteractive(element, protectedRoots) {
  if (!(element instanceof HTMLElement)) return true;
  if (isBodyChildExempt(element)) return true;

  return protectedRoots.some(
    (root) =>
      root === element || root.contains(element) || element.contains(root),
  );
}

export function syncBackgroundInteractivity(
  mode,
  { getInteractiveRootsForMode },
) {
  if (typeof document === 'undefined' || !document.body) return;

  const normalizedMode = normalizeOverlayMode(mode);
  const overlayActive = normalizedMode !== OVERLAY_MODES.NONE;
  const protectedRoots = overlayActive
    ? getInteractiveRootsForMode(normalizedMode)
    : [];
  const canIsolateBackground = !overlayActive || protectedRoots.length > 0;

  Array.from(document.body.children).forEach((element) => {
    if (!(element instanceof HTMLElement)) return;

    const shouldInert =
      canIsolateBackground &&
      overlayActive &&
      !shouldKeepBodyChildInteractive(element, protectedRoots);
    const managedByOverlayManager =
      element.getAttribute(OVERLAY_INERT_ATTR) === 'true';

    if (shouldInert) {
      element.inert = true;
      element.setAttribute(OVERLAY_INERT_ATTR, 'true');
      return;
    }

    if (managedByOverlayManager) {
      element.inert = false;
      element.removeAttribute(OVERLAY_INERT_ATTR);
    }
  });
}

// ============================================================================
// REGISTRY
// ============================================================================

/** @type {Map<string, OverlayController>} */
const overlayControllers = new Map();

function normalizeElementList(values) {
  if (!Array.isArray(values)) return [];
  return values.filter(
    (value) => value instanceof HTMLElement && value.isConnected,
  );
}

export function getOverlayController(mode) {
  return overlayControllers.get(normalizeOverlayMode(mode)) || null;
}

/**
 * @param {string} mode
 * @param {OverlayRootResolverName} methodName
 * @param {HTMLElement[]} [fallbackRoots]
 * @returns {HTMLElement[]}
 */
export function getControllerRoots(mode, methodName, fallbackRoots = []) {
  const controller = getOverlayController(mode);
  const values = normalizeElementList(controller?.[methodName]?.() || []);
  return values.length > 0 ? values : fallbackRoots;
}

/**
 * @param {string} mode
 * @param {OverlayFocusResolverName} methodName
 * @returns {HTMLElement|null}
 */
export function getControllerFocusElement(mode, methodName) {
  const controller = getOverlayController(mode);
  const element = controller?.[methodName]?.();
  return element instanceof HTMLElement && element.isConnected ? element : null;
}

/**
 * @param {string} mode
 * @param {OverlayController} [controller]
 * @returns {void}
 */
export function setOverlayController(mode, controller = {}) {
  overlayControllers.set(normalizeOverlayMode(mode), controller);
}

/**
 * @param {string} mode
 * @param {OverlayController|null} [controller]
 * @returns {void}
 */
export function deleteOverlayController(mode, controller = null) {
  const normalizedMode = normalizeOverlayMode(mode);
  if (!controller) {
    overlayControllers.delete(normalizedMode);
    return;
  }

  const currentController = overlayControllers.get(normalizedMode);
  if (currentController === controller) {
    overlayControllers.delete(normalizedMode);
  }
}

export function clearOverlayControllers() {
  overlayControllers.clear();
}
