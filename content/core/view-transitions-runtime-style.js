import {
  VIEW_TRANSITION_TIMINGS_MS,
  toCssMs,
} from './view-transition-timings.js';

export const VIEW_TRANSITION_RUNTIME_STYLE_ID =
  'core-view-transition-runtime-style';

/**
 * @param {boolean} enableCrossDocument
 * @returns {string}
 */
const getRuntimeStyles = (enableCrossDocument) => `
${enableCrossDocument ? '@view-transition { navigation: auto; }' : ''}
:root:active-view-transition-type(page-navigate)::view-transition-old(root),
:root:active-view-transition-type(same-page-scroll)::view-transition-old(root) {
  animation: vt-page-old var(--vt-page-old-duration, ${toCssMs(VIEW_TRANSITION_TIMINGS_MS.PAGE_OLD)}) cubic-bezier(0.4, 0, 1, 1) both;
}

:root:active-view-transition-type(page-navigate)::view-transition-new(root),
:root:active-view-transition-type(same-page-scroll)::view-transition-new(root) {
  animation: vt-page-new var(--vt-page-new-duration, ${toCssMs(VIEW_TRANSITION_TIMINGS_MS.PAGE_NEW)}) cubic-bezier(0, 0, 0.2, 1) both;
}

@keyframes vt-page-old {
  from {
    opacity: 1;
    transform: translateY(0);
  }
  to {
    opacity: 0;
    transform: translateY(8px);
  }
}

@keyframes vt-page-new {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
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

/**
 * @param {{injectNavigationStyles: boolean, enableCrossDocument: boolean}} options
 * @returns {void}
 */
export const injectViewTransitionRuntimeStyles = (options) => {
  if (!options.injectNavigationStyles) return;
  if (typeof document === 'undefined') return;

  let styleEl = document.getElementById(VIEW_TRANSITION_RUNTIME_STYLE_ID);
  if (!(styleEl instanceof HTMLStyleElement)) {
    styleEl = document.createElement('style');
    styleEl.id = VIEW_TRANSITION_RUNTIME_STYLE_ID;
    styleEl.dataset.injectedBy = 'core-view-transitions';
    document.head.appendChild(styleEl);
  }

  styleEl.textContent = getRuntimeStyles(options.enableCrossDocument);
};

export const removeViewTransitionRuntimeStyles = () => {
  if (typeof document === 'undefined') return;
  const runtimeStyle = document.getElementById(
    VIEW_TRANSITION_RUNTIME_STYLE_ID,
  );
  if (
    runtimeStyle instanceof HTMLStyleElement &&
    runtimeStyle.dataset.injectedBy === 'core-view-transitions'
  ) {
    runtimeStyle.remove();
  }
};
