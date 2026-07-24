/**
 * Centralized Overlay & Focus Module
 * Consolidates backdrop elements, body scroll lock, aria-isolation, registry, and focus trapping.
 * @author Abdulkerim Sesli
 * @version 7.0.0
 */

import { OVERLAY_MODES, activeOverlay, normalizeOverlayMode } from "../state/overlay-state.js";

// ============================================================================
// 1. BACKDROP & BODY SCROLL LOCK (formerly core.js)
// ============================================================================

const GLOBAL_BACKDROP_ID = "menu-global-backdrop";
const GLOBAL_BACKDROP_CLASS = "menu-global-backdrop overlay-backdrop overlay-backdrop--global";
const BACKDROP_CLOSE_GUARD_MS = 200;

const BACKDROP_VISIBLE_MODES = new Set([
  OVERLAY_MODES.MENU,
  OVERLAY_MODES.SEARCH,
  OVERLAY_MODES.ROBOT_CHAT,
  OVERLAY_MODES.FOOTER,
]);

const BODY_SCROLL_LOCKED_MODES = new Set([
  OVERLAY_MODES.SEARCH,
  OVERLAY_MODES.ROBOT_CHAT,
  OVERLAY_MODES.FOOTER,
]);

let backdropElement = null;
let backdropGuardElement = null;
let backdropCloseTimer = null;
let bodyScrollLockState = null;

const OVERLAY_SCROLL_KEYS = new Set([
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "End",
  "Home",
  "PageDown",
  "PageUp",
  " ",
]);

const EVENT_SCROLL_LOCK_ROOTS = new Map([
  [OVERLAY_MODES.FOOTER, "site-footer"],
  [OVERLAY_MODES.ROBOT_CHAT, "#robot-chat-window, #robot-companion-container"],
]);

function lockOverlayBackgroundScroll(mode, scrollY) {
  const abortController = new AbortController();
  const options = { capture: true, passive: false, signal: abortController.signal };
  const rootSelector = EVENT_SCROLL_LOCK_ROOTS.get(mode);
  const root = document.documentElement;
  const previousScrollBehavior = root.style.scrollBehavior;
  const previousScrollSnapType = root.style.scrollSnapType;
  const isInsideOverlay = target =>
    target instanceof Element && Boolean(rootSelector && target.closest(rootSelector));

  const blockPointerScroll = event => {
    if (isInsideOverlay(event.target)) return;
    event.preventDefault();
  };

  const blockKeyboardScroll = event => {
    if (!OVERLAY_SCROLL_KEYS.has(event.key) || isInsideOverlay(event.target)) return;
    event.preventDefault();
  };

  const restoreScrollPosition = () => {
    if (Math.abs(window.scrollY - scrollY) < 1) return;
    window.scrollTo(0, scrollY);
  };

  root.style.scrollBehavior = "auto";
  root.style.scrollSnapType = "none";
  restoreScrollPosition();

  window.addEventListener("wheel", blockPointerScroll, options);
  window.addEventListener("touchmove", blockPointerScroll, options);
  document.addEventListener("keydown", blockKeyboardScroll, options);
  window.addEventListener("scroll", restoreScrollPosition, {
    passive: true,
    signal: abortController.signal,
  });

  return () => {
    abortController.abort();
    root.style.scrollBehavior = previousScrollBehavior;
    root.style.scrollSnapType = previousScrollSnapType;
  };
}

function blockClosingBackdropClick(event) {
  if (!backdropElement?.classList.contains("is-closing")) return;

  event.preventDefault();
  event.stopPropagation();
}

function ensureBackdropClickGuard(element) {
  if (backdropGuardElement === element) return;

  backdropGuardElement?.removeEventListener("click", blockClosingBackdropClick, true);
  element.addEventListener("click", blockClosingBackdropClick, true);
  backdropGuardElement = element;
}

export function shouldModeShowBackdrop(mode) {
  return BACKDROP_VISIBLE_MODES.has(normalizeOverlayMode(mode));
}

export function ensureBackdropElement() {
  if (typeof document === "undefined" || !document.body) return null;
  if (backdropElement?.isConnected) return backdropElement;

  const existing = document.getElementById(GLOBAL_BACKDROP_ID);
  if (existing instanceof HTMLElement) {
    backdropElement = existing;
    ensureBackdropClickGuard(existing);
    return backdropElement;
  }

  const element = document.createElement("div");
  element.id = GLOBAL_BACKDROP_ID;
  element.className = GLOBAL_BACKDROP_CLASS;
  element.setAttribute("aria-hidden", "true");
  document.body.appendChild(element);
  backdropElement = element;
  ensureBackdropClickGuard(element);
  return backdropElement;
}

function shouldLockBodyScroll(mode) {
  const normalizedMode = normalizeOverlayMode(mode);
  if (BODY_SCROLL_LOCKED_MODES.has(normalizedMode)) return true;

  if (normalizedMode === OVERLAY_MODES.MENU) {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(max-width: 900px)").matches;
  }
  return false;
}

function lockBodyScroll(mode) {
  if (typeof document === "undefined" || !document.body || bodyScrollLockState) return;

  const body = document.body;
  const scrollY = typeof window !== "undefined" ? window.scrollY || window.pageYOffset || 0 : 0;

  const normalizedMode = normalizeOverlayMode(mode);
  if (EVENT_SCROLL_LOCK_ROOTS.has(normalizedMode)) {
    bodyScrollLockState = {
      mode: normalizedMode,
      cleanup: lockOverlayBackgroundScroll(normalizedMode, scrollY),
    };
    body.dataset.overlayScrollLocked = "true";
    return;
  }

  bodyScrollLockState = {
    mode: normalizeOverlayMode(mode),
    scrollY,
    style: {
      position: body.style.position || "",
      top: body.style.top || "",
      left: body.style.left || "",
      right: body.style.right || "",
      width: body.style.width || "",
      overflow: body.style.overflow || "",
    },
  };

  body.style.position = "fixed";
  body.style.top = `-${scrollY}px`;
  body.style.left = "0";
  body.style.right = "0";
  body.style.width = "100%";
  body.style.overflow = "hidden";
  body.dataset.overlayScrollLocked = "true";
}

function unlockBodyScroll() {
  if (typeof document === "undefined" || !document.body || !bodyScrollLockState) return;

  const body = document.body;
  const { mode, scrollY, style, cleanup } = bodyScrollLockState;

  if (EVENT_SCROLL_LOCK_ROOTS.has(mode)) {
    cleanup?.();
    delete body.dataset.overlayScrollLocked;
    bodyScrollLockState = null;
    return;
  }

  body.style.position = style.position;
  body.style.top = style.top;
  body.style.left = style.left;
  body.style.right = style.right;
  body.style.width = style.width;
  body.style.overflow = style.overflow;
  delete body.dataset.overlayScrollLocked;
  bodyScrollLockState = null;

  if (typeof window !== "undefined") {
    const root = document.documentElement;
    const previousScrollBehavior = root.style.scrollBehavior;
    root.style.scrollBehavior = "auto";
    window.scrollTo(0, Math.max(0, Number(scrollY) || 0));
    root.style.scrollBehavior = previousScrollBehavior;
  }
}

export function syncBodyOverlayState(mode) {
  if (typeof document === "undefined" || !document.body) return;
  const normalizedMode = normalizeOverlayMode(mode);
  const shouldLock = shouldLockBodyScroll(normalizedMode);
  const lockModeChanged = bodyScrollLockState && bodyScrollLockState.mode !== normalizedMode;

  // Restore the saved position while the previous overlay styles still
  // suppress scroll snapping. This avoids a visible jump on close.
  if (!shouldLock || lockModeChanged) unlockBodyScroll();

  document.body.dataset.activeOverlay = normalizedMode;

  const root = document.documentElement;
  if (root instanceof HTMLElement) {
    root.dataset.activeOverlay = normalizedMode;
  }

  if (shouldLock) lockBodyScroll(normalizedMode);
}

export function syncBackdropState(mode) {
  const normalizedMode = normalizeOverlayMode(mode);
  const hasExistingBackdrop = Boolean(backdropElement?.isConnected);
  const needsBackdrop = shouldModeShowBackdrop(normalizedMode) || hasExistingBackdrop;

  if (!needsBackdrop) return;

  const backdrop = ensureBackdropElement();
  if (!backdrop) return;

  const isOpen = shouldModeShowBackdrop(normalizedMode);
  if (isOpen) {
    if (backdropCloseTimer) clearTimeout(backdropCloseTimer);
    backdropCloseTimer = null;
    backdrop.classList.remove("is-closing");
    backdrop.classList.add("is-open");
    backdrop.dataset.mode = normalizedMode;
    return;
  }

  if (!backdrop.classList.contains("is-open")) {
    if (!backdrop.classList.contains("is-closing")) backdrop.dataset.mode = normalizedMode;
    return;
  }

  backdrop.classList.remove("is-open");
  backdrop.classList.add("is-closing");
  if (backdropCloseTimer) clearTimeout(backdropCloseTimer);
  backdropCloseTimer = setTimeout(() => {
    backdrop.classList.remove("is-closing");
    backdrop.dataset.mode = normalizedMode;
    backdropCloseTimer = null;
  }, BACKDROP_CLOSE_GUARD_MS);
}

// ============================================================================
// 2. ISOLATION
// ============================================================================

const OVERLAY_INERT_ATTR = "data-overlay-manager-inert";
const BODY_CHILD_EXEMPT_SELECTOR = [
  `#${GLOBAL_BACKDROP_ID}`,
  "#live-region-status",
  "#live-region-assertive",
  "[aria-live]",
  "[data-overlay-inert-exempt]",
].join(", ");

function isBodyChildExempt(element) {
  return Boolean(element instanceof HTMLElement && element.matches(BODY_CHILD_EXEMPT_SELECTOR));
}

function shouldKeepBodyChildInteractive(element, protectedRoots) {
  if (!(element instanceof HTMLElement)) return true;
  if (isBodyChildExempt(element)) return true;
  return protectedRoots.some(
    root => root === element || root.contains(element) || element.contains(root)
  );
}

export function syncBackgroundInteractivity(mode, { getInteractiveRootsForMode }) {
  if (typeof document === "undefined" || !document.body) return;

  const normalizedMode = normalizeOverlayMode(mode);
  const overlayActive = normalizedMode !== OVERLAY_MODES.NONE;
  const protectedRoots = overlayActive ? getInteractiveRootsForMode(normalizedMode) : [];
  const canIsolateBackground = !overlayActive || protectedRoots.length > 0;

  Array.from(document.body.children).forEach(element => {
    if (!(element instanceof HTMLElement)) return;

    const shouldInert =
      canIsolateBackground &&
      overlayActive &&
      !shouldKeepBodyChildInteractive(element, protectedRoots);
    const managedByOverlayManager = element.getAttribute(OVERLAY_INERT_ATTR) === "true";

    if (shouldInert) {
      element.inert = true;
      element.setAttribute(OVERLAY_INERT_ATTR, "true");
      return;
    }

    if (managedByOverlayManager) {
      element.inert = false;
      element.removeAttribute(OVERLAY_INERT_ATTR);
    }
  });
}

// ============================================================================
// 3. REGISTRY
// ============================================================================

const overlayControllers = new Map();

function normalizeElementList(values) {
  if (!Array.isArray(values)) return [];
  return values.filter(value => value instanceof HTMLElement && value.isConnected);
}

export function getOverlayController(mode) {
  return overlayControllers.get(normalizeOverlayMode(mode)) || null;
}

export function getControllerRoots(mode, methodName, fallbackRoots = []) {
  const controller = getOverlayController(mode);
  const values = normalizeElementList(controller?.[methodName]?.() || []);
  return values.length > 0 ? values : fallbackRoots;
}

export function getControllerFocusElement(mode, methodName) {
  const controller = getOverlayController(mode);
  const element = controller?.[methodName]?.();
  return element instanceof HTMLElement && element.isConnected ? element : null;
}

export function setOverlayController(mode, controller = {}) {
  overlayControllers.set(normalizeOverlayMode(mode), controller);
}

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

// ============================================================================
// 4. FOCUS TRAPPING & Restoring (formerly focus.js)
// ============================================================================

const OVERLAY_TEMP_FOCUS_ATTR = "data-overlay-manager-temp-focus";
const FOCUSABLE_SELECTOR = [
  "a[href]",
  "area[href]",
  "button:not([disabled])",
  'input:not([disabled]):not([type="hidden"])',
  "select:not([disabled])",
  "textarea:not([disabled])",
  "iframe",
  "object",
  "embed",
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

let currentFocusedOverlayMode = OVERLAY_MODES.NONE;
const pendingFocusChangeOptions = new Map();
let activeFocusSession = null;

function focusSafely(element) {
  if (!(element instanceof HTMLElement) || typeof element.focus !== "function") return false;
  try {
    element.focus({ preventScroll: true });
    return document.activeElement === element || getDeepActiveElement() === element;
  } catch {
    // noop
  }
  try {
    element.focus();
    return document.activeElement === element || getDeepActiveElement() === element;
  } catch {
    return false;
  }
}

function getDeepActiveElement() {
  if (typeof document === "undefined") return null;
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
  if (element.getAttribute("aria-hidden") === "true") return false;
  if ("disabled" in element && element.disabled) return false;

  const style = window.getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden") return false;
  return element.getClientRects().length > 0 || getDeepActiveElement() === element;
}

function getFocusableElements(roots) {
  const focusable = [];
  const seen = new Set();
  const pushFocusable = element => {
    if (!(element instanceof HTMLElement)) return;
    if (seen.has(element)) return;
    if (!isVisibleFocusableElement(element)) return;
    seen.add(element);
    focusable.push(element);
  };

  roots.forEach(root => {
    if (!(root instanceof HTMLElement) || !root.isConnected) return;
    if (root.matches(FOCUSABLE_SELECTOR)) pushFocusable(root);
    root.querySelectorAll(FOCUSABLE_SELECTOR).forEach(element => {
      pushFocusable(element);
    });
  });
  return focusable;
}

function isElementWithinRoots(element, roots) {
  if (!(element instanceof HTMLElement)) return false;
  return roots.some(root => root === element || root.contains(element) || element.contains(root));
}

function cleanupTempFocusElement(session) {
  const element = session?.tempFocusElement;
  if (element instanceof HTMLElement && element.getAttribute(OVERLAY_TEMP_FOCUS_ATTR) === "true") {
    element.removeAttribute("tabindex");
    element.removeAttribute(OVERLAY_TEMP_FOCUS_ATTR);
  }
  if (session) session.tempFocusElement = null;
}

function focusOverlayElement(target, roots, session) {
  if (target instanceof HTMLElement && isVisibleFocusableElement(target)) {
    cleanupTempFocusElement(session);
    return focusSafely(target);
  }

  const fallbackRoot = roots.find(root => root instanceof HTMLElement && root.isConnected);
  if (!(fallbackRoot instanceof HTMLElement)) return false;

  if (
    !fallbackRoot.hasAttribute("tabindex") &&
    fallbackRoot.getAttribute(OVERLAY_TEMP_FOCUS_ATTR) !== "true"
  ) {
    fallbackRoot.setAttribute("tabindex", "-1");
    fallbackRoot.setAttribute(OVERLAY_TEMP_FOCUS_ATTR, "true");
    session.tempFocusElement = fallbackRoot;
  }
  return focusSafely(fallbackRoot);
}

function scheduleOverlayInitialFocus(session, getControllerFocusElement, attempt = 0) {
  if (typeof requestAnimationFrame !== "function") return;
  requestAnimationFrame(() => {
    if (activeFocusSession !== session) return;

    const focusTarget =
      getControllerFocusElement(session.mode, "getPrimaryFocusTarget") ||
      getFocusableElements(session.roots)[0] ||
      null;
    const didFocus = focusOverlayElement(focusTarget, session.roots, session);
    if (!didFocus && attempt < 4) {
      scheduleOverlayInitialFocus(session, getControllerFocusElement, attempt + 1);
    }
  });
}

function handleOverlayTrapTabKey(event, session) {
  if (event.key !== "Tab" || activeFocusSession !== session) return;

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
    getControllerFocusElement(session.mode, "getPrimaryFocusTarget") ||
    getFocusableElements(session.roots)[0] ||
    null;
  focusOverlayElement(fallbackTarget, session.roots, session);
}

function setupFocusSession(mode, originFocus, getFocusTrapRootsForMode, getControllerFocusElement) {
  if (typeof document === "undefined") return;
  const roots = getFocusTrapRootsForMode(mode);
  if (roots.length === 0) return;

  const abortController = typeof AbortController === "function" ? new AbortController() : null;
  const session = {
    mode,
    roots,
    originFocus: originFocus || getControllerFocusElement(mode, "getRestoreFocusTarget"),
    restoreFocus: true,
    abortController,
    tempFocusElement: null,
  };

  activeFocusSession = session;
  scheduleOverlayInitialFocus(session, getControllerFocusElement);

  document.addEventListener("keydown", event => handleOverlayTrapTabKey(event, session), {
    capture: true,
    signal: abortController?.signal,
  });
  document.addEventListener(
    "focusin",
    () => handleOverlayTrapFocusIn(session, getControllerFocusElement),
    { capture: true, signal: abortController?.signal }
  );
}

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
  const fallbackTarget = getControllerFocusElement(mode, "getRestoreFocusTarget");

  requestAnimationFrame(() => {
    if (activeOverlay.value !== OVERLAY_MODES.NONE) return;
    if (
      originTarget instanceof HTMLElement &&
      originTarget.isConnected &&
      focusSafely(originTarget)
    )
      return;
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
  if (normalizedMode === OVERLAY_MODES.NONE || activeOverlay.value !== normalizedMode) return;
  pendingFocusChangeOptions.set(normalizedMode, {
    restoreFocus: options.restoreFocus !== false,
  });
}

export function syncOverlayFocusState(
  mode,
  { getFocusTrapRootsForMode, getControllerFocusElement }
) {
  const normalizedMode = normalizeOverlayMode(mode);
  if (normalizedMode === currentFocusedOverlayMode) return;

  const previousMode = currentFocusedOverlayMode;
  const nextOriginFocus =
    normalizedMode === OVERLAY_MODES.NONE ? null : getActiveRestorableElement();
  const previousFocusOptions =
    previousMode === OVERLAY_MODES.NONE ? null : consumePendingFocusChangeOptions(previousMode);

  if (previousMode !== OVERLAY_MODES.NONE) {
    teardownFocusSession({
      mode: previousMode,
      restoreFocus:
        normalizedMode === OVERLAY_MODES.NONE && previousFocusOptions?.restoreFocus !== false,
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
      getControllerFocusElement
    );
  }
}
