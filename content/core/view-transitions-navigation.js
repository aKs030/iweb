import { handleSamePageScroll } from './utils.js';
import {
  debugViewTransition,
  normalizeClassTokens,
  normalizeTimeout,
  normalizeTypes,
  withViewTransition,
} from './view-transitions-core.js';
import {
  DEFAULT_SCROLL_TRANSITION_TYPES,
  VIEW_TRANSITION_TYPES,
} from './view-transition-types.js';

const TOKEN_TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);

/**
 * @param {string} value
 * @returns {URL|null}
 */
const toURL = (value) => {
  try {
    const base = globalThis.location?.href || globalThis.location?.origin || '';
    return new URL(value, base);
  } catch {
    return null;
  }
};

/**
 * @param {URL} url
 * @returns {boolean}
 */
const isSameDocumentURL = (url) =>
  url.origin === globalThis.location.origin &&
  url.pathname === globalThis.location.pathname &&
  url.search === globalThis.location.search;

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
  const href = (link.getAttribute('href') || '').trim();
  if (!href) return true;
  if (href.startsWith('#')) return true;
  if (href.startsWith('mailto:') || href.startsWith('tel:')) return true;
  if (href.startsWith('javascript:')) return true;
  if (link.hasAttribute('download')) return true;
  if (link.target && link.target !== '_self') return true;

  const relValues = (link.getAttribute('rel') || '')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  if (relValues.includes('external')) return true;

  return false;
}

/**
 * @param {HTMLAnchorElement} link
 * @returns {boolean}
 */
const hasTransitionOptOut = (link) => {
  if (link.hasAttribute('data-no-transition')) return true;

  const value = String(link.getAttribute('data-view-transition') || '')
    .trim()
    .toLowerCase();

  return value === 'off' || value === 'false' || value === 'none';
};

/**
 * @param {HTMLAnchorElement} link
 * @returns {string[]}
 */
const getNavigationTypesFromLink = (link) => {
  const raw = String(
    link.getAttribute('data-view-transition-type') ||
      link.getAttribute('data-view-transition-types') ||
      '',
  );
  if (!raw) return [];

  const tokens = raw.split(/[\s,]+/g).filter(Boolean);
  return normalizeTypes(tokens);
};

/**
 * @param {string|null} value
 * @returns {boolean}
 */
const parseBooleanAttribute = (value) =>
  TOKEN_TRUE_VALUES.has(
    String(value || '')
      .trim()
      .toLowerCase(),
  );

/**
 * @param {HTMLAnchorElement} link
 * @returns {string[]}
 */
const getNavigationRootClassesFromLink = (link) => {
  const raw = String(
    link.getAttribute('data-view-transition-class') ||
      link.getAttribute('data-view-transition-classes') ||
      '',
  );

  if (!raw) return [];
  return normalizeClassTokens(raw.split(/[\s,]+/g).filter(Boolean));
};

/**
 * @param {HTMLAnchorElement} link
 * @returns {number|undefined}
 */
const getNavigationTimeoutFromLink = (link) => {
  const raw = link.getAttribute('data-view-transition-timeout');
  if (raw == null) return undefined;

  const timeout = Number(raw);
  if (!Number.isFinite(timeout) || timeout <= 0) return undefined;
  return normalizeTimeout(timeout);
};

/**
 * @param {HTMLAnchorElement} link
 * @returns {boolean}
 */
const shouldReplaceNavigationFromLink = (link) =>
  parseBooleanAttribute(link.getAttribute('data-view-transition-replace'));

/**
 * @param {HTMLAnchorElement} link
 * @param {URL} destination
 * @param {boolean} captureInternalLinks
 * @returns {boolean}
 */
const shouldHandleInternalNavigation = (
  link,
  destination,
  captureInternalLinks,
) => {
  if (!captureInternalLinks) return false;
  if (hasTransitionOptOut(link)) return false;
  if (destination.origin !== globalThis.location.origin) return false;
  if (isSameDocumentURL(destination)) return false;
  return true;
};

/**
 * Navigate with a transition where possible.
 *
 * @param {string} href
 * @param {import('./view-transitions-core.js').TransitionOptions & { replace?: boolean }} [options]
 * @param {{ navigationTypes: string[] }} [defaults]
 * @returns {boolean}
 */
export function navigateWithViewTransition(href, options = {}, defaults = {}) {
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

  debugViewTransition('navigation:intercept', {
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

/**
 * @param {{
 *   getCaptureInternalLinks: () => boolean,
 *   getNavigationTypes: () => string[],
 * }} options
 * @returns {(event: MouseEvent) => void}
 */
export const createDocumentClickHandler = (options) => {
  return (event) => {
    if (event.defaultPrevented) return;
    if (event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return;

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
        { types: [...DEFAULT_SCROLL_TRANSITION_TYPES] },
      );
      return;
    }

    const captureInternalLinks = options.getCaptureInternalLinks();
    if (
      !shouldHandleInternalNavigation(link, destination, captureInternalLinks)
    ) {
      return;
    }

    event.preventDefault();
    const customTypes = getNavigationTypesFromLink(link);
    const fallbackTypes = normalizeTypes(options.getNavigationTypes());
    const types = customTypes.length > 0 ? customTypes : fallbackTypes;
    const rootClasses = getNavigationRootClassesFromLink(link);
    const timeoutMs = getNavigationTimeoutFromLink(link);
    const replace = shouldReplaceNavigationFromLink(link);

    navigateWithViewTransition(
      destination.toString(),
      {
        types,
        rootClasses,
        timeoutMs,
        replace,
      },
      { navigationTypes: fallbackTypes },
    );
  };
};
