/**
 * Reactive Theme State
 *
 * Keeps document theme state in sync with user preference and system settings
 * without requiring a framework runtime.
 */

import { computed, signal } from './signals.js';

const LIGHT = 'light';
const DARK = 'dark';
const SYSTEM = 'system';
const MEDIA_QUERY = '(prefers-color-scheme: light)';
export const THEME_PREFERENCE_STORAGE_KEY = 'iweb-theme-preference';

const normalizeTheme = (value) => (value === LIGHT ? LIGHT : DARK);
const normalizePreference = (value) => {
  if (value === LIGHT || value === DARK || value === SYSTEM) return value;
  return SYSTEM;
};

const readSystemTheme = () => {
  try {
    return globalThis.matchMedia?.(MEDIA_QUERY).matches ? LIGHT : DARK;
  } catch {
    return DARK;
  }
};

const readStoredPreference = () => {
  try {
    return normalizePreference(
      globalThis.localStorage?.getItem(THEME_PREFERENCE_STORAGE_KEY),
    );
  } catch {
    return SYSTEM;
  }
};

const persistPreference = (preference) => {
  try {
    const storage = globalThis.localStorage;
    if (!storage) return;

    if (preference === SYSTEM) {
      storage.removeItem(THEME_PREFERENCE_STORAGE_KEY);
      return;
    }

    storage.setItem(THEME_PREFERENCE_STORAGE_KEY, preference);
  } catch {
    /* keep theme persistence best-effort */
  }
};

export const systemTheme = signal(readSystemTheme());
export const themePreference = signal(readStoredPreference());
export const resolvedTheme = computed(() =>
  themePreference.value === SYSTEM
    ? systemTheme.value
    : normalizeTheme(themePreference.value),
);

let _initialized = false;
let _mediaQueryList = null;
let _cleanupThemeSync = null;
let _handleSystemChange = null;

function applyThemeToDocument(theme) {
  if (typeof document === 'undefined') return;

  const nextTheme = normalizeTheme(theme);
  const root = document.documentElement;
  if (root.getAttribute('data-theme') === nextTheme) return;
  root.setAttribute('data-theme', nextTheme);
}

export function initThemeState() {
  if (_initialized) return;
  _initialized = true;

  systemTheme.value = readSystemTheme();
  themePreference.value = readStoredPreference();
  applyThemeToDocument(resolvedTheme.value);
  _cleanupThemeSync = resolvedTheme.subscribe((theme) => {
    applyThemeToDocument(theme);
  });

  if (typeof globalThis.matchMedia !== 'function') return;

  _mediaQueryList = globalThis.matchMedia(MEDIA_QUERY);
  systemTheme.value = _mediaQueryList.matches ? LIGHT : DARK;

  _handleSystemChange = (event) => {
    systemTheme.value = event.matches ? LIGHT : DARK;
  };

  if (typeof _mediaQueryList.addEventListener === 'function') {
    _mediaQueryList.addEventListener('change', _handleSystemChange);
  } else if (typeof _mediaQueryList.addListener === 'function') {
    _mediaQueryList.addListener(_handleSystemChange);
  }
}

export function setThemePreference(preference = SYSTEM) {
  const nextPreference = normalizePreference(preference);
  themePreference.value = nextPreference;
  persistPreference(nextPreference);
  return resolvedTheme.value;
}

export function setTheme(theme) {
  return setThemePreference(normalizeTheme(theme));
}

export function toggleTheme() {
  return setTheme(resolvedTheme.value === DARK ? LIGHT : DARK);
}

export function useSystemTheme() {
  return setThemePreference(SYSTEM);
}

export function getResolvedTheme() {
  return resolvedTheme.value;
}

export function destroyThemeState() {
  if (_cleanupThemeSync) {
    _cleanupThemeSync();
    _cleanupThemeSync = null;
  }

  if (_mediaQueryList) {
    if (
      _handleSystemChange &&
      typeof _mediaQueryList.removeEventListener === 'function'
    ) {
      _mediaQueryList.removeEventListener('change', _handleSystemChange);
    } else if (
      _handleSystemChange &&
      typeof _mediaQueryList.removeListener === 'function'
    ) {
      _mediaQueryList.removeListener(_handleSystemChange);
    }

    _mediaQueryList = null;
  }

  _handleSystemChange = null;

  _initialized = false;
}
