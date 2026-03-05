const OVERLAY_CLASS_MENU = 'menu-open';
const OVERLAY_CLASS_SEARCH = 'search-open';
const OVERLAY_CLASSES = [OVERLAY_CLASS_MENU, OVERLAY_CLASS_SEARCH];

/**
 * @param {'menu'|'search'|null} mode
 */
export const setMenuOverlayState = (mode) => {
  if (typeof document === 'undefined' || !document.body) return;

  document.body.classList.remove(...OVERLAY_CLASSES);
  if (mode === 'menu') {
    document.body.classList.add(OVERLAY_CLASS_MENU);
    return;
  }
  if (mode === 'search') {
    document.body.classList.add(OVERLAY_CLASS_SEARCH);
  }
};

export const clearMenuOverlayState = () => {
  setMenuOverlayState(null);
};
