/**
 * Internationalization (i18n) Manager
 * Handles language state, translation loading, and event broadcasting.
 * @version 1.1.0
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
    if (this.loadingPromise) return this.loadingPromise;

    this.loadingPromise = (async () => {
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
      document.documentElement.lang =
        this.currentLang === 'de' ? 'de-DE' : 'en-US';
      log.info(`Initialized with language: ${this.currentLang}`);

      // Initial translation of the page
      if (typeof document !== 'undefined') {
        const ready = document.readyState !== 'loading' && document.body;
        if (ready) {
          this.translatePage();
          this.updateMetadata();
        } else if (typeof window !== 'undefined') {
          // Defer until DOM is ready to ensure document.body exists
          window.addEventListener(
            'DOMContentLoaded',
            () => {
              this.translatePage();
              this.updateMetadata();
            },
            { once: true },
          );
        }
      }

      // Dispatch initial event for eager subscribers
      this.dispatchEvent(
        new CustomEvent('language-changed', {
          detail: { lang: this.currentLang },
        }),
      );
    })().finally(() => {
      this.loadingPromise = null;
    });

    return this.loadingPromise;
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

      // Fallback strategy:
      const defaultLang = 'de';
      if (lang !== defaultLang) {
        try {
          // Attempt to load the default language if not already loaded
          await this.loadTranslations(defaultLang);
        } catch {
          // Logged in recursive call
        }
        // Use default lang or empty object
        this.translations[lang] = this.translations[defaultLang] || {};
      } else {
        // Default failed, empty object to prevent crashes
        this.translations[lang] = {};
      }
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

    this.translatePage();
    this.updateMetadata();

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

    // Simple interpolation: "Hello {{name}}"
    return value.replace(/\{\{(\w+)\}\}/g, (_, k) => {
      return params[k] !== undefined ? params[k] : `{{${k}}}`;
    });
  }

  /**
   * Translates an entire page or checks the body
   */
  translatePage() {
    this.translateElement(document.body);
  }

  /**
   * Translates a specific element and its children using data-i18n attributes
   * @param {HTMLElement|Element} element
   */
  translateElement(element) {
    if (!element) return;

    // 1. Text Content: data-i18n
    const textElements = element.querySelectorAll
      ? Array.from(element.querySelectorAll('[data-i18n]'))
      : [];

    // Include the root element itself if it matches
    if (element.hasAttribute?.('data-i18n')) {
      textElements.push(element);
    }

    textElements.forEach((el) => {
      const key = el.getAttribute('data-i18n');
      if (key) {
        // Note: textContent assignment overwrites all child elements,
        // including any existing fallback HTML structure.
        el.textContent = this.t(key);
      }
    });

    // 2. Inner HTML: data-i18n-html (Use with caution - Potential XSS risk)
    // Ensure translation keys used here come from trusted sources.
    const htmlElements = element.querySelectorAll
      ? Array.from(element.querySelectorAll('[data-i18n-html]'))
      : [];

    if (element.hasAttribute?.('data-i18n-html')) {
      htmlElements.push(element);
    }

    htmlElements.forEach((el) => {
      const key = el.getAttribute('data-i18n-html');
      if (key) {
        const translated = this.t(key);
        // Sanitize HTML to prevent XSS - strict allowlist approach
        const ALLOWED_TAGS =
          /^(b|i|em|strong|a|br|span|p|ul|ol|li|small|sub|sup)$/i;
        const clean = translated.replace(
          /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi,
          (match, tag) => {
            if (!ALLOWED_TAGS.test(tag)) return '';
            // Remove event handlers and javascript: from allowed tags
            return match
              .replace(/\s+on\w+\s*=\s*(["'])[^"']*\1/gi, '')
              .replace(/\s+on\w+\s*=[^\s>]*/gi, '')
              .replace(/javascript\s*:/gi, '');
          },
        );
        el.innerHTML = clean;
      }
    });

    // 3. Attributes: data-i18n-attrs="placeholder:key,title:key2"
    const attrElements = element.querySelectorAll
      ? Array.from(element.querySelectorAll('[data-i18n-attrs]'))
      : [];

    if (element.hasAttribute?.('data-i18n-attrs')) {
      attrElements.push(element);
    }

    attrElements.forEach((el) => {
      const config = el.getAttribute('data-i18n-attrs');
      if (!config) return;

      const mappings = config.split(',');
      mappings.forEach((mapping) => {
        const [attr, key] = mapping.split(':').map((s) => s.trim());
        if (attr && key) {
          el.setAttribute(attr, this.t(key));
        }
      });
    });
  }

  /**
   * Updates document title and meta description based on current language
   */
  updateMetadata() {
    // Title
    const title = this.t('meta.title');
    if (title !== 'meta.title') {
      document.title = title;
    }

    // Meta Description
    const metaDesc = document.querySelector('meta[name="description"]');
    const desc = this.t('meta.description');
    if (metaDesc && desc !== 'meta.description') {
      metaDesc.setAttribute('content', desc);
    }
  }

  /**
   * Subscribe to language changes
   * @param {Function} callback
   */
  subscribe(callback) {
    const handler = (e) => callback(e.detail.lang);
    this.addEventListener('language-changed', handler);
    // Immediately invoke with current state if initialized
    if (this.initialized) {
      callback(this.currentLang);
    }
    // Return unsubscribe function
    return () => this.removeEventListener('language-changed', handler);
  }
}

export const i18n = new LanguageManager();

// Auto-init
if (typeof window !== 'undefined') {
  // Wait for DOM to be somewhat ready or just start immediately
  // We want it early so UI builds with correct lang
  i18n.init().catch((e) => log.error('Failed to auto-init i18n', e));
}
