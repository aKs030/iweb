/**
 * Menu Renderer - Handles DOM rendering
 */

import { MenuTemplate } from './MenuTemplate.js';
import { i18n } from '#core/i18n.js';

/**
 * @typedef {import('./MenuState.js').MenuState} MenuState
 */
/**
 * @typedef {typeof import('./MenuConfig.js').MenuConfig} MenuComponentConfig
 */
/**
 * @typedef {Partial<MenuComponentConfig>} MenuComponentConfigInput
 */

export class MenuRenderer {
  /**
   * @param {MenuState} state
   * @param {MenuComponentConfigInput} [config]
   */
  constructor(state, config = {}) {
    this.state = state;
    this.config = config;
    this.template = new MenuTemplate(config);
    this.container = null;
    this.iconTimeout = null; // used by initializeIcons
    this._i18nUnsub = null; // cleaned up in destroy
    this._stateCleanupFns = [];
  }

  /**
   * Renders the initial menu structure
   * @param {HTMLElement} container
   */
  render(container) {
    this.container = container;
    container.innerHTML = this.template.getHTML();

    // wire state subscriptions _before_ syncing so changes apply immediately
    this.setupStateSubscriptions();

    // Initial Language Sync
    const currentLang = /** @type {any} */ (i18n).getCurrentLanguage
      ? /** @type {any} */ (i18n).getCurrentLanguage()
      : 'de';
    this.updateLanguage(currentLang);
  }

  initializeIcons() {
    const delay = this.config.ICON_CHECK_DELAY || 100;
    this.iconTimeout = setTimeout(() => {
      // clear reference early to avoid leaks when container is removed during delay
      this.iconTimeout = null;
      if (!this.container) return;

      const icons = this.container.querySelectorAll('.nav-icon use');
      icons.forEach((use) => {
        const href = use.getAttribute('href');
        if (!href) return;

        const targetId = href.substring(1);
        const target = this.container.querySelector(`#${targetId}`);
        const svg = use.closest('svg');
        const fallback = svg
          ?.closest('a, button')
          ?.querySelector('.icon-fallback');

        // If SVG symbol is missing, show fallback emoji/text
        if (!target && fallback) {
          if (svg instanceof SVGElement) {
            svg.setAttribute('hidden', '');
          }
          fallback.classList.remove('icon-fallback--hidden');
        }
      });
    }, delay);
  }

  setupStateSubscriptions() {
    this._stateCleanupFns.forEach((cleanup) => cleanup());
    this._stateCleanupFns = [];

    // Open/Close State
    this._stateCleanupFns.push(
      this.state.signals.open.subscribe((isOpen) => {
        const toggle = this.container.querySelector('.site-menu__toggle');
        const menu = this.container.querySelector('.site-menu');

        if (menu) menu.classList.toggle('open', isOpen);
        if (toggle) toggle.classList.toggle('active', isOpen);

        // Accessibility update
        if (toggle) toggle.setAttribute('aria-expanded', String(isOpen));
      }),
    );

    // Active Link State
    this._stateCleanupFns.push(
      this.state.signals.activeLink.subscribe((activeHref) => {
        this.updateActiveLink(activeHref);
      }),
    );

    // Title State
    this._stateCleanupFns.push(
      this.state.signals.title.subscribe(({ title, subtitle }) => {
        this.updateTitle(title, subtitle);
      }),
    );

    // Language State
    // keep unsubscribe function for cleanup
    this._i18nUnsub = i18n.subscribe((lang) => {
      this.updateLanguage(lang);
    });
  }

  updateActiveLink(activeHref) {
    if (!this.container) return;

    const links = this.container.querySelectorAll('.site-menu a');
    links.forEach((link) => {
      const href = link.getAttribute('href');
      // Simple string comparison usually works due to normalization in Events
      const isActive = href === activeHref;

      if (isActive) {
        link.classList.add('active');
        link.setAttribute('aria-current', 'page');
      } else {
        link.classList.remove('active');
        link.removeAttribute('aria-current');
      }
    });
  }

  updateLanguage(lang) {
    if (typeof lang !== 'string') return;
    if (!this.container) return;

    // Update Toggle Text
    const langText = this.container.querySelector('.lang-text');
    if (langText) {
      langText.textContent = lang.toUpperCase();
    }

    const textElements = this.container.querySelectorAll('[data-i18n]');
    textElements.forEach((el) => {
      const key = el.getAttribute('data-i18n');
      if (key) {
        el.textContent = i18n.t(key);
      }
    });

    const ariaElements = this.container.querySelectorAll('[data-i18n-aria]');
    ariaElements.forEach((el) => {
      const key = el.getAttribute('data-i18n-aria');
      if (key) {
        el.setAttribute('aria-label', i18n.t(key));
      }
    });

    const titleElements = this.container.querySelectorAll('[data-i18n-title]');
    titleElements.forEach((el) => {
      const key = el.getAttribute('data-i18n-title');
      if (key) {
        el.setAttribute('title', i18n.t(key));
      }
    });

    const placeholderElements = this.container.querySelectorAll(
      '[data-i18n-placeholder]',
    );
    placeholderElements.forEach((el) => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (key) {
        el.setAttribute('placeholder', i18n.t(key));
      }
    });

    // Re-render title with new language
    if (this.state) {
      this.updateTitle(this.state.currentTitle, this.state.currentSubtitle);
    }
  }

  updateTitle(title, subtitle = '') {
    if (!this.container) return;

    const siteTitleEl = this.container.querySelector('.site-title');
    const siteSubtitleEl = this.container.querySelector('.site-subtitle');

    if (!siteTitleEl) return;

    const translatedTitle = i18n.t(title);
    let translatedSubtitle = i18n.t(subtitle);

    // Prevent duplicate subtitle
    if (translatedTitle === translatedSubtitle) {
      translatedSubtitle = '';
    }

    // Optimize: Check if text content is already correct
    if (
      siteTitleEl.textContent === translatedTitle &&
      (!siteSubtitleEl || siteSubtitleEl.textContent === translatedSubtitle)
    ) {
      // Just ensure subtitle visibility is correct
      if (siteSubtitleEl) {
        if (translatedSubtitle) siteSubtitleEl.classList.add('show');
        else siteSubtitleEl.classList.remove('show');
      }
      return;
    }

    siteTitleEl.textContent = translatedTitle;

    if (siteSubtitleEl) {
      siteSubtitleEl.textContent = translatedSubtitle;
      siteSubtitleEl.classList.toggle('show', Boolean(translatedSubtitle));
    }
  }

  destroy() {
    if (this.iconTimeout) {
      clearTimeout(this.iconTimeout);
      this.iconTimeout = null;
    }
    this._stateCleanupFns.forEach((cleanup) => cleanup());
    this._stateCleanupFns = [];
    if (typeof this._i18nUnsub === 'function') {
      this._i18nUnsub();
      this._i18nUnsub = null;
    }
    this.container = null;
  }
}
