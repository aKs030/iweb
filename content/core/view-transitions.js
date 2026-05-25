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
  normalizeTypes,
  withViewTransition,
  createDocumentClickHandler,
  injectViewTransitionRuntimeStyles,
  applyViewTransitionTimingVars,
  DEFAULT_NAVIGATION_TRANSITION_TYPES,
} from "./view-transitions/index.js";

/**
 * @typedef {Object} ViewTransitionInitOptions
 * @property {boolean} [captureInternalLinks] - Intercept same-origin page links
 * @property {boolean} [enableCrossDocument] - Enable @view-transition navigation:auto
 * @property {boolean} [injectNavigationStyles] - Inject minimal default page transition styles
 * @property {string[]} [navigationTypes] - Types used for captured internal-link navigation
 */

const INIT_CONFIG = {
  captureInternalLinks: true,
  enableCrossDocument: false,
  injectNavigationStyles: true,
  /** @type {string[]} */
  navigationTypes: [...DEFAULT_NAVIGATION_TRANSITION_TYPES],
};

let isInitialized = false;
/** @type {(event: MouseEvent) => void | null} */
let clickHandler = null;

/**
 * @param {ViewTransitionInitOptions} options
 */
const applyInitConfig = (options = {}) => {
  if (typeof options.captureInternalLinks === "boolean") {
    INIT_CONFIG.captureInternalLinks = options.captureInternalLinks;
  }
  if (typeof options.enableCrossDocument === "boolean") {
    INIT_CONFIG.enableCrossDocument = options.enableCrossDocument;
  }
  if (typeof (/** @type {any} */ (options).injectNavigationStyles) === "boolean") {
    INIT_CONFIG.injectNavigationStyles = /** @type {any} */ (options).injectNavigationStyles;
  }

  const navigationTypes = normalizeTypes(/** @type {any} */ (options).navigationTypes);
  if (navigationTypes && navigationTypes.length) {
    INIT_CONFIG.navigationTypes = navigationTypes;
  }
};

/**
 * Update runtime config for view transitions. Safe to call multiple times.
 *
 * @param {ViewTransitionInitOptions} [options]
 */
function configureViewTransitions(options = {}) {
  applyInitConfig(options);
  applyViewTransitionTimingVars();
  injectViewTransitionRuntimeStyles({
    injectNavigationStyles: INIT_CONFIG.injectNavigationStyles,
    enableCrossDocument: INIT_CONFIG.enableCrossDocument,
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

  document.addEventListener("click", clickHandler);
}

export { withViewTransition };
