/**
 * Centralized View Transitions Module
 * Consolidates view transition constants, core wrapper, navigation click handler, and runtime styles.
 * @author Abdulkerim Sesli
 * @version 7.0.0
 */

/* eslint-disable no-console */
import { handleSamePageScroll, applyCspNonce } from "../utils/index.js";

// ============================================================================
// 1. CONSTANTS (formerly constants.js)
// ============================================================================

export const VIEW_TRANSITION_TIMINGS_MS = Object.freeze({
  DEFAULT_TIMEOUT: 5000,
  PAGE_OLD: 180,
  PAGE_NEW: 240,
  THEME_TIMEOUT: 1200,
  MENU_TIMEOUT: 900,
  SEARCH_TIMEOUT: 750,
  SECTION_SWAP_TIMEOUT: 1500,
});

const TIMING_CSS_VARS = Object.freeze({
  "--vt-page-old-duration": VIEW_TRANSITION_TIMINGS_MS.PAGE_OLD,
  "--vt-page-new-duration": VIEW_TRANSITION_TIMINGS_MS.PAGE_NEW,
});

export const toCssMs = valueMs => `${Math.max(0, Math.round(valueMs))}ms`;

export const applyViewTransitionTimingVars = () => {
  if (typeof document === "undefined") return;
  const rootStyle = document.documentElement?.style;
  if (!rootStyle) return;
  for (const [name, valueMs] of Object.entries(TIMING_CSS_VARS)) {
    rootStyle.setProperty(name, toCssMs(valueMs));
  }
};

export const VIEW_TRANSITION_TYPES = Object.freeze({
  PAGE_NAVIGATE: "page-navigate",
  SAME_PAGE_SCROLL: "same-page-scroll",
  LOADER_HIDE: "loader-hide",
  THEME_CHANGE: "theme-change",
  MENU_OPEN: "menu-open",
  MENU_CLOSE: "menu-close",
  SEARCH_OPEN: "search-open",
  SEARCH_CLOSE: "search-close",
  SECTION_SWAP: "section-swap",
  CHAT_OPEN: "chat-open",
  CHAT_CLOSE: "chat-close",
  CHAT_TOOL_RESULT: "chat-tool-result",
  CHAT_TYPING_SHOW: "chat-typing-show",
  CHAT_TYPING_HIDE: "chat-typing-hide",
  CHAT_MESSAGE_ADD: "chat-message-add",
  CHAT_CLEAR: "chat-clear",
});

export const DEFAULT_NAVIGATION_TRANSITION_TYPES = Object.freeze([
  VIEW_TRANSITION_TYPES.PAGE_NAVIGATE,
]);

export const DEFAULT_SCROLL_TRANSITION_TYPES = Object.freeze([
  VIEW_TRANSITION_TYPES.SAME_PAGE_SCROLL,
]);

export const BACKDROP_SENSITIVE_TRANSITION_TYPES = Object.freeze([
  VIEW_TRANSITION_TYPES.MENU_OPEN,
  VIEW_TRANSITION_TYPES.MENU_CLOSE,
  VIEW_TRANSITION_TYPES.SEARCH_OPEN,
  VIEW_TRANSITION_TYPES.SEARCH_CLOSE,
]);

export const VIEW_TRANSITION_ROOT_CLASSES = Object.freeze({
  MENU: "vt-menu",
  THEME_CHANGE: "vt-theme-change",
  SECTION_SWAP: "vt-section-swap",
});

// ============================================================================
// 2. CORE TRANSITION LOGIC (formerly core.js)
// ============================================================================

const MAX_TOKEN_COUNT = 8;
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const MOBILE_MENU_QUERY = "(max-width: 900px)";
const MENU_HOST_SELECTOR = "site-menu";
const MENU_PANEL_SELECTOR = ".site-menu";
const DEBUG_FLAG = "__VT_DEBUG__";
const BACKDROP_SENSITIVE_TYPES = new Set(BACKDROP_SENSITIVE_TRANSITION_TYPES);

const VT_EVENTS = Object.freeze({
  START: "viewtransition:start",
  FINISH: "viewtransition:finish",
  ERROR: "viewtransition:error",
});

let transitionQueue = Promise.resolve();
let reducedMotionMql = null;
let prefersReducedMotion = false;

const isSupported = () =>
  typeof document !== "undefined" && typeof document.startViewTransition === "function";

const supportsTypedTransitions = () => isSupported() && typeof ViewTransition !== "undefined";

const isTruthyValue = value => {
  const token = String(value ?? "")
    .trim()
    .toLowerCase();
  return token === "1" || token === "true" || token === "yes" || token === "on";
};

const isViewTransitionDebugEnabled = () => {
  const runtimeFlag = typeof globalThis !== "undefined" ? globalThis[DEBUG_FLAG] : undefined;
  if (isTruthyValue(runtimeFlag)) return true;
  try {
    const params = new URLSearchParams(globalThis.location?.search || "");
    if (isTruthyValue(params.get("vt_debug"))) return true;
  } catch {
    // ignore
  }
  return false;
};

export const debugViewTransition = (message, detail = {}) => {
  if (!isViewTransitionDebugEnabled()) return;
  try {
    console.debug("[view-transitions]", message, detail);
  } catch {
    // ignore
  }
};

const getMediaQueryList = query => {
  if (typeof globalThis.matchMedia === "function") return globalThis.matchMedia(query);
  if (typeof window !== "undefined" && typeof window.matchMedia === "function")
    return window.matchMedia(query);
  return null;
};

const isAbortError = error =>
  !!error &&
  typeof error === "object" &&
  "name" in error &&
  (error.name === "AbortError" || error.name === "TimeoutError");

const getErrorMessage = error =>
  error && typeof error === "object" && "message" in error ? String(error.message) : String(error);

const skipTransitionSafely = transition => {
  try {
    transition?.skipTransition?.();
  } catch {
    // ignore
  }
};

const normalizeTokens = (value, maxCount = MAX_TOKEN_COUNT) => {
  if (!Array.isArray(value)) return [];
  const unique = new Set();
  for (const entry of value) {
    if (typeof entry !== "string") continue;
    const token = entry.trim().toLowerCase();
    if (!token) continue;
    if (!/^[a-z0-9_-]{1,48}$/i.test(token)) continue;
    unique.add(token);
    if (unique.size >= maxCount) break;
  }
  return [...unique];
};

export const normalizeTypes = value => normalizeTokens(value);
export const normalizeClassTokens = value => normalizeTokens(value);

export const normalizeTimeout = value => {
  const timeout = Number(value);
  if (!Number.isFinite(timeout) || timeout <= 0) {
    return VIEW_TRANSITION_TIMINGS_MS.DEFAULT_TIMEOUT;
  }
  return Math.max(250, Math.min(Math.round(timeout), 20000));
};

const silencePromiseRejection = promise => {
  promise?.catch(() => {});
};

const guardTransitionPromises = transition => {
  silencePromiseRejection(transition?.ready);
  silencePromiseRejection(transition?.updateCallbackDone);
};

const ensureReducedMotionObserver = () => {
  if (reducedMotionMql) return;
  const mql = getMediaQueryList(REDUCED_MOTION_QUERY);
  if (!mql) return;
  prefersReducedMotion = !!mql.matches;
  reducedMotionMql = mql;
  mql.addEventListener("change", event => {
    prefersReducedMotion = !!event.matches;
  });
};

const shouldUseTransitions = options => {
  if (!isSupported()) return false;
  if (options.force) return true;
  ensureReducedMotionObserver();
  if (options.respectReducedMotion !== false && prefersReducedMotion) return false;
  if (document.hidden) return false;
  return true;
};

const isMobileViewport = () => {
  const mql = getMediaQueryList(MOBILE_MENU_QUERY);
  return mql ? !!mql.matches : false;
};

const isNoneBackdropFilter = value => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  return !normalized || normalized === "none" || /^blur\(\s*0(?:px)?\s*\)$/.test(normalized);
};

const hasActiveBackdropEffect = style => {
  const standard = style.backdropFilter || "";
  const webkit = style.webkitBackdropFilter || "";
  return !isNoneBackdropFilter(standard) || !isNoneBackdropFilter(webkit);
};

const getMenuPanels = () => {
  if (typeof document === "undefined") return [];
  const panels = new Set();
  document.querySelectorAll(MENU_PANEL_SELECTOR).forEach(node => {
    if (node instanceof HTMLElement) panels.add(node);
  });
  document.querySelectorAll(MENU_HOST_SELECTOR).forEach(host => {
    const root = host.shadowRoot || host;
    const panel = root.querySelector(MENU_PANEL_SELECTOR);
    if (panel instanceof HTMLElement) panels.add(panel);
  });
  return [...panels];
};

const anyMenuPanelStyleMatches = predicate => {
  if (typeof globalThis.getComputedStyle !== "function") return false;
  for (const panel of getMenuPanels()) {
    const style = globalThis.getComputedStyle(panel);
    if (predicate(style)) return true;
  }
  return false;
};

const isMenuDrawerLayoutActive = () =>
  anyMenuPanelStyleMatches(style => style.position === "fixed");
const hasMenuBackdropGlassActive = () =>
  anyMenuPanelStyleMatches(style => hasActiveBackdropEffect(style));

const shouldSkipForLiveBackdrop = (types, options) => {
  if (!types.length) return false;
  if (options.force) return false;
  if (options.preserveLiveBackdropOnMobile === false) return false;
  if (!types.some(type => BACKDROP_SENSITIVE_TYPES.has(type))) return false;
  if (isMobileViewport()) return true;
  if (isMenuDrawerLayoutActive()) return true;
  if (hasMenuBackdropGlassActive()) return true;
  return false;
};

const startTransition = (update, types) => {
  if (types.length && supportsTypedTransitions()) {
    return document.startViewTransition({ update, types });
  }
  return document.startViewTransition(update);
};

const MAX_TRANSITION_QUEUE_DEPTH = 5;
let transitionQueueDepth = 0;

const runInTransitionQueue = async task => {
  if (transitionQueueDepth >= MAX_TRANSITION_QUEUE_DEPTH) {
    debugViewTransition("queue:overflow-drop", { depth: transitionQueueDepth });
    return;
  }
  transitionQueueDepth += 1;
  const queuedTask = transitionQueue.then(task, task);
  transitionQueue = queuedTask.catch(() => {});
  try {
    await queuedTask;
  } finally {
    transitionQueueDepth -= 1;
  }
};

const withTimeout = (promise, timeoutMs, onTimeout) => {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return promise;
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      try {
        onTimeout();
      } catch {
        // ignore
      }
      const timeoutError = new Error("View transition timed out.");
      timeoutError.name = "TimeoutError";
      reject(timeoutError);
    }, timeoutMs);

    Promise.resolve(promise)
      .then(() => resolve())
      .catch(reject)
      .finally(() => clearTimeout(timeoutId));
  });
};

const applyRootClasses = classTokens => {
  if (!classTokens.length || !document.documentElement) return () => {};
  document.documentElement.classList.add(...classTokens);
  return () => document.documentElement.classList.remove(...classTokens);
};

const dispatchTransitionEvent = (eventName, detail) => {
  try {
    document.dispatchEvent(new CustomEvent(eventName, { detail }));
  } catch {
    // ignore
  }
};

export async function withViewTransition(callback, options = {}) {
  if (typeof callback !== "function") return;
  await runInTransitionQueue(async () => {
    try {
      if (options.signal?.aborted) {
        debugViewTransition("skip:aborted-signal", {});
        await callback();
        return;
      }
      const types = normalizeTypes(options.types);
      if (shouldSkipForLiveBackdrop(types, options)) {
        debugViewTransition("skip:live-backdrop", { types });
        await callback();
        return;
      }
      if (!shouldUseTransitions(options)) {
        debugViewTransition("skip:transitions-disabled", { types });
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
        debugViewTransition("fallback:start-failed", {
          types,
          message: getErrorMessage(error),
        });
        await callback();
        return;
      }

      debugViewTransition("start", { types, timeoutMs, rootClasses });
      guardTransitionPromises(transition);

      const finishedPromise = Promise.resolve(transition?.finished);
      silencePromiseRejection(finishedPromise);

      const typedTransition = transition;
      if (types.length && typedTransition?.types && typedTransition.types.size === 0) {
        for (const token of types) {
          typedTransition.types.add(token);
        }
      }

      if (options.signal) {
        options.signal.addEventListener("abort", () => skipTransitionSafely(transition), {
          once: true,
        });
      }

      dispatchTransitionEvent(VT_EVENTS.START, { types, ts: Date.now() });

      try {
        await withTimeout(finishedPromise, timeoutMs, () => skipTransitionSafely(transition));
        dispatchTransitionEvent(VT_EVENTS.FINISH, { types, ts: Date.now() });
        debugViewTransition("finish", { types });
      } catch (error) {
        const message = getErrorMessage(error);
        dispatchTransitionEvent(VT_EVENTS.ERROR, { types, ts: Date.now(), message });
        debugViewTransition("error", { types, message });
        if (!updateExecuted && !isAbortError(error)) {
          await callback();
        }
      } finally {
        cleanupRootClasses();
      }
    } catch {
      // ignore
    }
  });
}

// ============================================================================
// 3. INTERCEPT CLICK HANDLER & NAVIGATION (formerly navigation.js)
// ============================================================================

const TOKEN_TRUE_VALUES = new Set(["1", "true", "yes", "on"]);

const toURL = value => {
  try {
    const base = globalThis.location?.href || globalThis.location?.origin || "";
    return new URL(value, base);
  } catch {
    return null;
  }
};

const isSameDocumentURL = url =>
  url.origin === globalThis.location.origin &&
  url.pathname === globalThis.location.pathname &&
  url.search === globalThis.location.search;

function getEventAnchor(event) {
  const path = event.composedPath?.() || [];
  for (const node of path) {
    if (node instanceof HTMLAnchorElement && node.hasAttribute("href")) {
      return node;
    }
  }
  const target = event.target;
  if (!(target instanceof Element)) return null;
  return target.closest("a[href]");
}

function shouldIgnoreLink(link) {
  const href = (link.getAttribute("href") || "").trim();
  if (!href) return true;
  if (href.startsWith("#")) return true;
  if (href.startsWith("mailto:") || href.startsWith("tel:")) return true;
  if (href.startsWith("javascript:")) return true;
  if (link.hasAttribute("download")) return true;
  if (link.target && link.target !== "_self") return true;
  const relValues = (link.getAttribute("rel") || "").toLowerCase().split(/\s+/).filter(Boolean);
  if (relValues.includes("external")) return true;
  return false;
}

const hasTransitionOptOut = link => {
  if (link.hasAttribute("data-no-transition")) return true;
  const value = String(link.getAttribute("data-view-transition") || "")
    .trim()
    .toLowerCase();
  return value === "off" || value === "false" || value === "none";
};

const getNavigationTypesFromLink = link => {
  const raw = String(
    link.getAttribute("data-view-transition-type") ||
      link.getAttribute("data-view-transition-types") ||
      ""
  );
  if (!raw) return [];
  return normalizeTypes(raw.split(/[\s,]+/g).filter(Boolean));
};

const parseBooleanAttribute = value =>
  TOKEN_TRUE_VALUES.has(
    String(value || "")
      .trim()
      .toLowerCase()
  );

const getNavigationRootClassesFromLink = link => {
  const raw = String(
    link.getAttribute("data-view-transition-class") ||
      link.getAttribute("data-view-transition-classes") ||
      ""
  );
  if (!raw) return [];
  return normalizeClassTokens(raw.split(/[\s,]+/g).filter(Boolean));
};

const getNavigationTimeoutFromLink = link => {
  const raw = link.getAttribute("data-view-transition-timeout");
  if (raw == null) return undefined;
  const timeout = Number(raw);
  if (!Number.isFinite(timeout) || timeout <= 0) return undefined;
  return normalizeTimeout(timeout);
};

const shouldReplaceNavigationFromLink = link =>
  parseBooleanAttribute(link.getAttribute("data-view-transition-replace"));

const shouldHandleInternalNavigation = (link, destination, captureInternalLinks) => {
  if (!captureInternalLinks) return false;
  if (hasTransitionOptOut(link)) return false;
  if (destination.origin !== globalThis.location.origin) return false;
  if (isSameDocumentURL(destination)) return false;
  return true;
};

function navigateWithViewTransition(href, options = {}, defaults = { navigationTypes: [] }) {
  const url = toURL(href);
  if (!url) return false;

  const navigate = () => {
    if (options.replace) {
      globalThis.location.replace(url.toString());
      return;
    }
    globalThis.location.href = url.toString();
  };

  if (url.origin !== globalThis.location.origin) {
    navigate();
    return true;
  }

  const types = normalizeTypes(options.types);
  const fallbackTypes = normalizeTypes(defaults.navigationTypes || []);
  const mergedTypes =
    types.length > 0
      ? types
      : fallbackTypes.length > 0
        ? fallbackTypes
        : [VIEW_TRANSITION_TYPES.PAGE_NAVIGATE];

  debugViewTransition("navigation:intercept", {
    href: url.toString(),
    types: mergedTypes,
    replace: !!options.replace,
  });

  void withViewTransition(navigate, {
    ...options,
    types: mergedTypes,
  });
  return true;
}

export const createDocumentClickHandler = options => {
  return event => {
    if (event.defaultPrevented) return;
    if (event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const link = getEventAnchor(event);
    if (!link || shouldIgnoreLink(link)) return;

    const destination = toURL(link.href);
    if (!destination) return;

    if (isSameDocumentURL(destination) && !destination.hash) {
      event.preventDefault();
      void withViewTransition(
        () => {
          handleSamePageScroll(destination.toString());
        },
        { types: [...DEFAULT_SCROLL_TRANSITION_TYPES] }
      );
      return;
    }

    const captureInternalLinks = options.getCaptureInternalLinks();
    if (!shouldHandleInternalNavigation(link, destination, captureInternalLinks)) return;

    event.preventDefault();
    const customTypes = getNavigationTypesFromLink(link);
    const fallbackTypes = normalizeTypes(options.getNavigationTypes());
    const types = customTypes.length > 0 ? customTypes : fallbackTypes;
    const rootClasses = getNavigationRootClassesFromLink(link);
    const timeoutMs = getNavigationTimeoutFromLink(link);
    const replace = shouldReplaceNavigationFromLink(link);

    navigateWithViewTransition(
      destination.toString(),
      { types, rootClasses, timeoutMs, replace },
      { navigationTypes: fallbackTypes }
    );
  };
};

// ============================================================================
// 4. RUNTIME STYLES INJECTION (formerly runtime-style.js)
// ============================================================================

const VIEW_TRANSITION_RUNTIME_STYLE_ID = "core-view-transition-runtime-style";

const getRuntimeStyles = enableCrossDocument => `
${enableCrossDocument ? "@view-transition { navigation: auto; }" : ""}
:root:active-view-transition-type(page-navigate)::view-transition-old(root),
:root:active-view-transition-type(same-page-scroll)::view-transition-old(root) {
  animation: vt-page-old var(--vt-page-old-duration, ${toCssMs(VIEW_TRANSITION_TIMINGS_MS.PAGE_OLD)}) cubic-bezier(0.4, 0, 1, 1) both;
}

:root:active-view-transition-type(page-navigate)::view-transition-new(root),
:root:active-view-transition-type(same-page-scroll)::view-transition-new(root) {
  animation: vt-page-new var(--vt-page-new-duration, ${toCssMs(VIEW_TRANSITION_TIMINGS_MS.PAGE_NEW)}) cubic-bezier(0, 0, 0.2, 1) both;
}

@keyframes vt-page-old {
  from { opacity: 1; transform: translateY(0); }
  to { opacity: 0; transform: translateY(8px); }
}

@keyframes vt-page-new {
  from { opacity: 0; transform: translateY(-8px); }
  to { opacity: 1; transform: translateY(0); }
}

@media (prefers-reduced-motion: reduce) {
  :root:active-view-transition-type(page-navigate)::view-transition-old(root),
  :root:active-view-transition-type(page-navigate)::view-transition-new(root),
  :root:active-view-transition-type(same-page-scroll)::view-transition-old(root),
  :root:active-view-transition-type(same-page-scroll)::view-transition-new(root) {
    animation: none !important;
  }
}
`;

export const injectViewTransitionRuntimeStyles = options => {
  if (!options.injectNavigationStyles) return;
  if (typeof document === "undefined") return;

  let styleEl = document.getElementById(VIEW_TRANSITION_RUNTIME_STYLE_ID);
  if (!(styleEl instanceof HTMLStyleElement)) {
    styleEl = document.createElement("style");
    styleEl.id = VIEW_TRANSITION_RUNTIME_STYLE_ID;
    styleEl.dataset.injectedBy = "core-view-transitions";
    applyCspNonce(styleEl);
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = getRuntimeStyles(options.enableCrossDocument);
};
