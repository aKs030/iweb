/**
 * Menu Renderer - Handles DOM rendering
 */

import { MenuTemplate } from './MenuTemplate.js';
import { getElementById } from '../../../core/utils.js';
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
  }

  /**
   * Renders the initial menu structure
   * @param {HTMLElement} container
   */
  render(container) {
    this.container = container;
    container.innerHTML = this.template.getHTML();
    this.updateYear();
    this.initializeIcons();
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

  updateYear() {
    const yearEl = getElementById('current-year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();
  }

  initializeIcons() {
    const delay = this.config.ICON_CHECK_DELAY || 100;
    setTimeout(() => {
      const icons = document.querySelectorAll('.nav-icon use');
      icons.forEach((use) => {
        const href = use.getAttribute('href');
        if (!href) return;

        const targetId = href.substring(1);
        const target = document.getElementById(targetId);
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
    i18n.subscribe((lang) => {
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

    // Update Toggle Text
    const langText = this.container.querySelector('.lang-text');
    if (langText) {
      langText.textContent = lang.toUpperCase();
    }

    // Update Menu Items
    const menuItems = this.container.querySelectorAll(
      '.site-menu__list a span[data-i18n], .site-menu__list button[aria-label]',
    );

    menuItems.forEach((el) => {
      // Text content translation
      if (el.hasAttribute('data-i18n')) {
        const key = el.getAttribute('data-i18n');
        el.textContent = i18n.t(key);
      }
      // Aria-label translation (for buttons)
      if (el.hasAttribute('aria-label') && el.getAttribute('data-i18n-aria')) {
        const key = el.getAttribute('data-i18n-aria');
        el.setAttribute('aria-label', i18n.t(key));
      }
    });

    // Re-render title with new language
    if (this.state) {
      // Force update by temporarily clearing to ensure animation or text update triggers
      this.updateTitle(this.state.currentTitle, this.state.currentSubtitle);
    }
  }

  updateTitle(title, subtitle = '') {
    const siteTitleEl = getElementById('site-title');
    const siteSubtitleEl = getElementById('site-subtitle');

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
    this.container = null;
  }
}
