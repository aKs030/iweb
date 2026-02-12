/**
 * Menu Renderer - Handles DOM rendering
 */

import { MenuTemplate } from './MenuTemplate.js';
import { getElementById } from '../../../core/utils.js';
import { i18n } from '../../../core/i18n.js';

export class MenuRenderer {
  constructor(state, config = {}) {
    this.state = state;
    this.config = config;
    this.template = new MenuTemplate(config);
    this.rafId = null;
  }

  render(container) {
    container.innerHTML = this.template.getHTML();
    this.updateYear();
    this.initializeIcons();
    this.setupTitleUpdates();
    this.setupLanguageUpdates();
  }

  updateYear() {
    const yearEl = getElementById('current-year');
    if (yearEl) yearEl.textContent = new Date().getFullYear(); // ✅ Called once on render
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
        const fallback = svg?.nextElementSibling;

        if (!target && fallback?.classList.contains('icon-fallback')) {
          svg.style.display = 'none';
          fallback.style.display = 'inline-block';
        }
      });
    }, delay);
  }

  setupTitleUpdates() {
    this.state.on('titleChange', ({ title, subtitle }) => {
      this.updateTitle(title, subtitle);
    });
  }

  setupLanguageUpdates() {
    i18n.subscribe((lang) => {
      this.updateLanguage(lang);
    });
  }

  updateLanguage(lang) {
    // Update Toggle Text
    const langText = document.querySelector('.lang-text');
    if (langText) {
      langText.textContent = lang.toUpperCase();
    }

    // Update Menu Items
    const menuItems = document.querySelectorAll(
      '.site-menu__list a span[data-i18n]',
    );

    menuItems.forEach((span) => {
      const key = span.getAttribute('data-i18n');
      if (key) {
        span.textContent = i18n.t(key);
      }
    });

    // Update Title if it matches a known key
    // We use the state's current title which should be the key
    if (this.state) {
      this.updateTitle(this.state.currentTitle, this.state.currentSubtitle);
    }
  }

  updateTitle(title, subtitle = '') {
    const siteTitleEl = getElementById('site-title');
    const siteSubtitleEl = getElementById('site-subtitle');

    if (!siteTitleEl) return;

    // Check if title/subtitle are translation keys
    // This is a naive check, but robust enough for now
    const translatedTitle = i18n.t(title);
    const translatedSubtitle = i18n.t(subtitle);

    // Cancel previous animation
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
    }

    this.rafId = requestAnimationFrame(() => {
      const transitionDelay = this.config.TITLE_TRANSITION_DELAY || 200;

      siteTitleEl.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
      siteTitleEl.style.opacity = '0.6';
      siteTitleEl.style.transform = 'scale(0.95)';

      if (siteSubtitleEl) siteSubtitleEl.classList.remove('show');

      setTimeout(() => {
        siteTitleEl.textContent = translatedTitle;
        siteTitleEl.style.opacity = '1';
        siteTitleEl.style.transform = 'scale(1)';

        if (siteSubtitleEl && translatedSubtitle) {
          siteSubtitleEl.textContent = translatedSubtitle;
          setTimeout(() => siteSubtitleEl.classList.add('show'), 100);
        }
      }, transitionDelay);
    });
  }

  destroy() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
    }
  }
}
