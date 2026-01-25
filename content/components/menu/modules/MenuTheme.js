/**
 * Menu Theme System
 * Dynamic theme switching
 */

export class MenuTheme {
  constructor(config = {}) {
    this.config = config;
    this.currentTheme = 'default';
    this.themes = new Map();
    this.registerDefaultThemes();
  }

  registerDefaultThemes() {
    // Default theme (current)
    this.register('default', {
      '--dynamic-menu-header-bg': 'rgba(0, 0, 0, 0.8)',
      '--dynamic-menu-label-primary': '#ffffff',
      '--dynamic-menu-label-secondary': 'rgba(255, 255, 255, 0.7)',
      '--dynamic-menu-accent-blue': '#007aff',
      '--dynamic-menu-fill-primary': 'rgba(255, 255, 255, 0.1)',
      '--dynamic-menu-separator': 'rgba(255, 255, 255, 0.1)',
    });

    // Light theme
    this.register('light', {
      '--dynamic-menu-header-bg': 'rgba(255, 255, 255, 0.95)',
      '--dynamic-menu-label-primary': '#000000',
      '--dynamic-menu-label-secondary': 'rgba(0, 0, 0, 0.6)',
      '--dynamic-menu-accent-blue': '#007aff',
      '--dynamic-menu-fill-primary': 'rgba(0, 0, 0, 0.05)',
      '--dynamic-menu-separator': 'rgba(0, 0, 0, 0.1)',
    });

    // Dark theme
    this.register('dark', {
      '--dynamic-menu-header-bg': 'rgba(0, 0, 0, 0.95)',
      '--dynamic-menu-label-primary': '#ffffff',
      '--dynamic-menu-label-secondary': 'rgba(255, 255, 255, 0.6)',
      '--dynamic-menu-accent-blue': '#0a84ff',
      '--dynamic-menu-fill-primary': 'rgba(255, 255, 255, 0.15)',
      '--dynamic-menu-separator': 'rgba(255, 255, 255, 0.15)',
    });

    // Colorful theme
    this.register('colorful', {
      '--dynamic-menu-header-bg':
        'linear-gradient(135deg, rgba(102, 126, 234, 0.9), rgba(118, 75, 162, 0.9))',
      '--dynamic-menu-label-primary': '#ffffff',
      '--dynamic-menu-label-secondary': 'rgba(255, 255, 255, 0.8)',
      '--dynamic-menu-accent-blue': '#ffd700',
      '--dynamic-menu-fill-primary': 'rgba(255, 255, 255, 0.2)',
      '--dynamic-menu-separator': 'rgba(255, 255, 255, 0.2)',
    });
  }

  register(name, variables) {
    this.themes.set(name, variables);
  }

  apply(themeName) {
    const theme = this.themes.get(themeName);
    if (!theme) {
      console.warn(`[Menu Theme] Theme "${themeName}" not found`);
      return false;
    }

    const header = document.querySelector('.site-header');
    if (!header) return false;

    // Apply CSS variables
    Object.entries(theme).forEach(([key, value]) => {
      header.style.setProperty(key, value);
    });

    this.currentTheme = themeName;

    // Dispatch event
    window.dispatchEvent(
      new CustomEvent('menuThemeChange', {
        detail: { theme: themeName },
      }),
    );

    return true;
  }

  get(themeName) {
    return this.themes.get(themeName);
  }

  getCurrent() {
    return this.currentTheme;
  }

  getAll() {
    return Array.from(this.themes.keys());
  }

  remove(themeName) {
    this.themes.delete(themeName);
  }

  // Auto-detect system theme
  detectSystemTheme() {
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  }

  // Apply system theme
  applySystemTheme() {
    const theme = this.detectSystemTheme();
    this.apply(theme);
  }

  // Watch for system theme changes
  watchSystemTheme() {
    const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
    darkModeQuery.addEventListener('change', (e) => {
      const theme = e.matches ? 'dark' : 'light';
      this.apply(theme);
    });
  }
}
