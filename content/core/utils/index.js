/**
 * Public facade for shared core utilities.
 * Keep implementation details inside `internal/` and import utilities through this file.
 */

export {
  cancelIdleTask,
  debounce,
  handleSamePageScroll,
  scheduleIdleTask,
  throttle,
  waitForReadyState,
} from "./internal/async.js";
export {
  addManagedEventListener,
  applyCspNonce,
  createObserver,
  getElementById,
  loadHeadStylesheet,
  observeOnce,
  upsertHeadLink,
  upsertMeta,
} from "./internal/dom.js";
export { fetchJSON, fetchText, fetchWithRetry } from "./internal/fetch.js";
export { canonicalizeUrlPath, normalizePathname } from "./internal/path.js";
export { sanitizeHTML, setSanitizedHTML } from "./internal/sanitize.js";
export {
  escapeHtml,
  escapeRegExp,
  escapeXml,
  formatSlug,
  humanizeSlug,
  normalizeForMatch,
  normalizeSchemaText,
  normalizeText,
  sanitizeDiscoveryText,
  stripBranding,
  uniqueSchemaList,
} from "./internal/text.js";
export { TimerManager } from "./internal/timer.js";
export {
  formatCompactUrlPath,
  normalizeHttpUrl,
  sanitizeInternalNavigationUrl,
} from "./internal/url.js";
export { createUseTranslation } from "./internal/react.js";
