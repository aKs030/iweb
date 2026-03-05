/**
 * Central View Transition timings (JS + CSS variable bridge).
 * Values are in milliseconds unless noted otherwise.
 */

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
  '--vt-page-old-duration': VIEW_TRANSITION_TIMINGS_MS.PAGE_OLD,
  '--vt-page-new-duration': VIEW_TRANSITION_TIMINGS_MS.PAGE_NEW,
});

/**
 * @param {number} valueMs
 * @returns {string}
 */
export const toCssMs = (valueMs) => `${Math.max(0, Math.round(valueMs))}ms`;

/**
 * Keep CSS transition timing vars in sync with JS timing source.
 * Safe to call repeatedly.
 */
export const applyViewTransitionTimingVars = () => {
  if (typeof document === 'undefined') return;
  const rootStyle = document.documentElement?.style;
  if (!rootStyle) return;

  for (const [name, valueMs] of Object.entries(TIMING_CSS_VARS)) {
    rootStyle.setProperty(name, toCssMs(valueMs));
  }
};
