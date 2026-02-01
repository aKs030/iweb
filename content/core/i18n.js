/**
 * Internationalization (i18n) Manager
 * Handles language state, translation loading, and event broadcasting.
 * @version 1.0.0
 */

import { createLogger } from '/content/core/logger.js';

const log = createLogger('LanguageManager');

class LanguageManager extends EventTarget {
  constructor() {
    super();
    this.currentLang = 'de'; // Default
    this.translations = {
      de: null,
      en: null,
    };
    this.initialized = false;
    this.loadingPromise = null;
  }

  /**
   * Initialize the language manager
   * loads preference from localStorage or detects browser language
   */
  async init() {
    if (this.initialized) return;

    // 1. Check LocalStorage
    let savedLang = localStorage.getItem('app_language');

    // 2. Check Browser Language if no preference saved
    if (!savedLang) {
      const browserLang = navigator.language.slice(0, 2);
      savedLang = browserLang === 'de' ? 'de' : 'en'; // Default fallback to EN for non-DE
    }

    // Validate
    if (!['de', 'en'].includes(savedLang)) {
      savedLang = 'de';
    }

    this.currentLang = savedLang;
    await this.loadTranslations(this.currentLang);

    this.initialized = true;
    log.info(`Initialized with language: ${this.currentLang}`);

    // Dispatch initial event for eager subscribers
    this.dispatchEvent(
      new CustomEvent('language-changed', {
        detail: { lang: this.currentLang },
      }),
    );
  }

  /**
   * Load translations for a specific language
   * @param {string} lang
   */
  async loadTranslations(lang) {
    if (this.translations[lang]) return; // Already loaded

    try {
      const response = await fetch(`/content/config/locales/${lang}.json`);
      if (!response.ok) throw new Error(`Failed to load ${lang} translations`);
      this.translations[lang] = await response.json();
      log.debug(`Loaded translations for ${lang}`);
    } catch (error) {
      log.error(`Error loading translations for ${lang}`, error);
      // Fallback: if EN fails, try DE, etc. (prevent infinite loop though)
    }
  }

  /**
   * Set the active language
   * @param {string} lang 'de' or 'en'
   */
  async setLanguage(lang) {
    if (lang === this.currentLang) return;
    if (!['de', 'en'].includes(lang)) {
      log.warn(`Unsupported language: ${lang}`);
      return;
    }

    log.info(`Switching language to ${lang}`);

    // Ensure translations are loaded
    await this.loadTranslations(lang);

    this.currentLang = lang;
    localStorage.setItem('app_language', lang);
    document.documentElement.lang = lang === 'de' ? 'de-DE' : 'en-US';

    this.dispatchEvent(
      new CustomEvent('language-changed', {
        detail: { lang: this.currentLang },
      }),
    );
  }

  /**
   * Toggle between available languages
   */
  toggleLanguage() {
    const newLang = this.currentLang === 'de' ? 'en' : 'de';
    this.setLanguage(newLang);
  }

  /**
   * Get a translation string
   * @param {string} key Dot-notation key (e.g., 'menu.home')
   * @param {Object} params Optional parameters for interpolation
   * @returns {string} Translated string or key if missing
   */
  t(key, params = {}) {
    if (!this.translations[this.currentLang]) {
      // If translations aren't loaded yet (rare if init awaited), return key
      return key;
    }

    const keys = key.split('.');
    let value = this.translations[this.currentLang];

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return key; // Missing key
      }
    }

    if (typeof value !== 'string') return key;

    // Simple interpolation: "Hello {name}"
    return value.replace(/\{(\w+)\}/g, (_, k) => {
      return params[k] !== undefined ? params[k] : `{${k}}`;
    });
  }

  /**
   * Subscribe to language changes
   * @param {Function} callback
   */
  subscribe(callback) {
    this.addEventListener('language-changed', (e) => {
      callback(e.detail.lang);
    });
    // Immediately invoke with current state if initialized
    if (this.initialized) {
      callback(this.currentLang);
    }
  }
}

export const i18n = new LanguageManager();

// Auto-init
if (typeof window !== 'undefined') {
  // Wait for DOM to be somewhat ready or just start immediately
  // We want it early so UI builds with correct lang
  i18n.init().catch((e) => log.error('Failed to auto-init i18n', e));
}
