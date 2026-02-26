/**
 * Menu Renderer - Handles DOM rendering
 */

import { MenuTemplate } from './MenuTemplate.js';
import { i18n } from '../../../core/i18n.js';

/**
 * @typedef {import('./MenuState.js').MenuState} MenuState
 */

export class MenuRenderer {
  /**
   * @param {MenuState} state
   * @param {Object} config
   */
  constructor(state, config = {}) {
    this.state = state;
    this.config = config;
    this.template = new MenuTemplate(config);
    this.rafId = null;
    this.container = null;
    this.iconTimeout = null; // used by initializeIcons
    this._i18nUnsub = null; // cleaned up in destroy
  }

  /**
   * Renders the initial menu structure
   * @param {HTMLElement} container
   */
  render(container) {
    this.container = container;
    container.innerHTML = this.template.getHTML();
    // removed legacy year update - handled via static markup or server

    // wire state subscriptions _before_ syncing so changes apply immediately
    this.setupStateSubscriptions();

    // Initial State Sync
    this.updateActiveLink(this.state.activeLink);
    this.updateTitle(this.state.currentTitle, this.state.currentSubtitle);

    // Initial Language Sync
    const currentLang = i18n.getCurrentLanguage
      ? i18n.getCurrentLanguage()
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
          if (svg) svg.style.display = 'none';
          fallback.style.display = 'inline-block';
        }
      });
    }, delay);
  }

  setupStateSubscriptions() {
    // Open/Close State
    this.state.on('openChange', (isOpen) => {
      const toggle = this.container.querySelector('.site-menu__toggle');
      const menu = this.container.querySelector('.site-menu');

      if (menu) menu.classList.toggle('open', isOpen);
      if (toggle) toggle.classList.toggle('active', isOpen);

      // Accessibility update
      if (toggle) toggle.setAttribute('aria-expanded', String(isOpen));
    });

    // Active Link State
    this.state.on('activeLinkChange', (activeHref) => {
      this.updateActiveLink(activeHref);
    });

    // Title State
    this.state.on('titleChange', ({ title, subtitle }) => {
      this.updateTitle(title, subtitle);
    });

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
      // Force update by temporarily clearing to ensure animation or text update triggers
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

    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
    }

    // Animate change
    this.rafId = requestAnimationFrame(() => {
      const transitionDelay = this.config.TITLE_TRANSITION_DELAY || 200;

      // Exit
      siteTitleEl.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
      siteTitleEl.style.opacity = '0';
      siteTitleEl.style.transform = 'translateY(5px)';

      if (siteSubtitleEl) {
        siteSubtitleEl.style.opacity = '0';
        siteSubtitleEl.classList.remove('show');
      }

      setTimeout(() => {
        // Update
        siteTitleEl.textContent = translatedTitle;

        // Enter
        siteTitleEl.style.opacity = '1';
        siteTitleEl.style.transform = 'translateY(0)';

        if (siteSubtitleEl && translatedSubtitle) {
          siteSubtitleEl.textContent = translatedSubtitle;
          siteSubtitleEl.style.opacity = ''; // Let CSS handle it via class
          // Small delay for subtitle cascade
          setTimeout(() => siteSubtitleEl.classList.add('show'), 50);
        }
      }, transitionDelay);
    });
  }

  destroy() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
    }
    if (this.iconTimeout) {
      clearTimeout(this.iconTimeout);
      this.iconTimeout = null;
    }
    if (typeof this._i18nUnsub === 'function') {
      this._i18nUnsub();
      this._i18nUnsub = null;
    }
    this.container = null;
  }
}
