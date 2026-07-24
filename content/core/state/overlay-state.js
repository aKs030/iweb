import { signal } from "../signals.js";
/** @typedef {import('../types.js').OverlayMode} OverlayMode */

export const OVERLAY_MODES = Object.freeze({
  NONE: "none",
  MENU: "menu",
  SEARCH: "search",
  ROBOT_CHAT: "robot-chat",
  FOOTER: "footer",
});

/** @type {{ value: OverlayMode, peek: () => OverlayMode, subscribe: (fn: (value: OverlayMode) => void) => () => boolean }} */
export const activeOverlay = signal(OVERLAY_MODES.NONE);

/**
 * @param {string|null|undefined} mode
 * @returns {OverlayMode}
 */
export function normalizeOverlayMode(mode) {
  switch (String(mode || "none").trim()) {
    case OVERLAY_MODES.MENU:
    case OVERLAY_MODES.SEARCH:
    case OVERLAY_MODES.ROBOT_CHAT:
    case OVERLAY_MODES.FOOTER:
      return /** @type {OverlayMode} */ (String(mode).trim());
    default:
      return OVERLAY_MODES.NONE;
  }
}

export function commitActiveOverlay(mode) {
  activeOverlay.value = normalizeOverlayMode(mode);
}
