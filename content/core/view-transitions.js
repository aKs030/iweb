/**
 * View Transitions API - Progressive Enhancement
 *
 * Public facade that composes the internal transition modules:
 * - core transition wrapper
 * - navigation interception
 * - runtime style injection
 *
 * @version 6.0.0
 */

import {
  destroyViewTransitionCore,
  isSupported,
  normalizeTypes,
  withElementViewTransitionName,
  withViewTransition,
} from './view-transitions-core.js';
import {
  createDocumentClickHandler,
  navigateWithViewTransition as navigateWithViewTransitionInternal,
} from './view-transitions-navigation.js';
import {
  injectViewTransitionRuntimeStyles,
  removeViewTransitionRuntimeStyles,
} from './view-transitions-runtime-style.js';
import { applyViewTransitionTimingVars } from './view-transition-timings.js';
import { DEFAULT_NAVIGATION_TRANSITION_TYPES } from './view-transition-types.js';

/**
 * @typedef {Object} ViewTransitionInitOptions
 * @property {boolean=} captureInternalLinks - Intercept same-origin page links
 * @property {boolean=} enableCrossDocument - Enable @view-transition navigation:auto
 * @property {boolean=} injectNavigationStyles - Inject minimal default page transition styles
 * @property {string[]=} navigationTypes - Types used for navigateWithViewTransition()
 */

const INIT_CONFIG = {
  captureInternalLinks: true,
  enableCrossDocument: true,
  injectNavigationStyles: true,
  navigationTypes: [...DEFAULT_NAVIGATION_TRANSITION_TYPES],
};

let isInitialized = false;
/** @type {(event: MouseEvent) => void | null} */
let clickHandler = null;

/**
 * @param {ViewTransitionInitOptions} options
 */
const applyInitConfig = (options = {}) => {
  if (typeof options.captureInternalLinks === 'boolean') {
    INIT_CONFIG.captureInternalLinks = options.captureInternalLinks;
  }
  if (typeof options.enableCrossDocument === 'boolean') {
    INIT_CONFIG.enableCrossDocument = options.enableCrossDocument;
  }
  if (typeof options.injectNavigationStyles === 'boolean') {
    INIT_CONFIG.injectNavigationStyles = options.injectNavigationStyles;
  }

  const navigationTypes = normalizeTypes(options.navigationTypes);
  if (navigationTypes.length) {
    INIT_CONFIG.navigationTypes = navigationTypes;
  }
};

/**
 * Update runtime config for view transitions. Safe to call multiple times.
 *
 * @param {ViewTransitionInitOptions} [options]
 */
export function configureViewTransitions(options = {}) {
  applyInitConfig(options);
  applyViewTransitionTimingVars();
  injectViewTransitionRuntimeStyles({
    injectNavigationStyles: INIT_CONFIG.injectNavigationStyles,
    enableCrossDocument: INIT_CONFIG.enableCrossDocument,
  });
}

/**
 * Navigate with a transition where possible.
 *
 * @param {string} href
 * @param {import('./view-transitions-core.js').TransitionOptions & { replace?: boolean }} [options]
 * @returns {boolean}
 */
export function navigateWithViewTransition(href, options = {}) {
  return navigateWithViewTransitionInternal(href, options, {
    navigationTypes: INIT_CONFIG.navigationTypes,
  });
}

/**
 * Initialize View Transitions support hooks.
 *
 * @param {ViewTransitionInitOptions} [options]
 */
export function initViewTransitions(options = {}) {
  configureViewTransitions(options);

  if (isInitialized) return;
  isInitialized = true;

  clickHandler = createDocumentClickHandler({
    getCaptureInternalLinks: () => INIT_CONFIG.captureInternalLinks,
    getNavigationTypes: () => INIT_CONFIG.navigationTypes,
  });

  document.addEventListener('click', clickHandler);
}

/**
 * Optional teardown (useful in tests or isolated embeds).
 */
export function destroyViewTransitions() {
  if (isInitialized && clickHandler) {
    document.removeEventListener('click', clickHandler);
  }

  clickHandler = null;
  isInitialized = false;

  destroyViewTransitionCore();
  removeViewTransitionRuntimeStyles();
}

export { isSupported, withElementViewTransitionName, withViewTransition };
