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
    this.container = null; // Store reference to container
  }

  render(container) {
    this.container = container;
    container.innerHTML = this.template.getHTML();
    this.updateYear();
    this.initializeIcons();
    this.setupStateSubscriptions();

    // Initial State Sync
    this.updateActiveLink(this.state.activeLink);
    this.updateTitle(this.state.currentTitle, this.state.currentSubtitle);
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
        const fallback = svg?.nextElementSibling;

        if (!target && fallback?.classList.contains('icon-fallback')) {
          svg.style.display = 'none';
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

      // Check for match
      if (href === activeHref) {
        link.classList.add('active');
        link.setAttribute('aria-current', 'page');
      } else {
        link.classList.remove('active');
        link.removeAttribute('aria-current');
      }
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
    if (this.state) {
      this.updateTitle(this.state.currentTitle, this.state.currentSubtitle);
    }
  }

  updateTitle(title, subtitle = '') {
    const siteTitleEl = getElementById('site-title');
    const siteSubtitleEl = getElementById('site-subtitle');

    if (!siteTitleEl) return;

    // Translate if possible
    const translatedTitle = i18n.t(title);
    let translatedSubtitle = i18n.t(subtitle);

    // Prevent duplicate subtitle if it matches title
    if (translatedTitle === translatedSubtitle) {
      translatedSubtitle = '';
    }

    // Cancel previous animation
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
    }

    this.rafId = requestAnimationFrame(() => {
      const transitionDelay = this.config.TITLE_TRANSITION_DELAY || 200;

      // Start exit animation
      siteTitleEl.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
      siteTitleEl.style.opacity = '0.6';
      siteTitleEl.style.transform = 'scale(0.95)';

      if (siteSubtitleEl) {
        siteSubtitleEl.classList.remove('show');
      }

      setTimeout(() => {
        // Update content
        siteTitleEl.textContent = translatedTitle;

        // Start enter animation
        siteTitleEl.style.opacity = '1';
        siteTitleEl.style.transform = 'scale(1)';

        if (siteSubtitleEl && translatedSubtitle) {
          siteSubtitleEl.textContent = translatedSubtitle;
          // Small delay for subtitle entrance
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
