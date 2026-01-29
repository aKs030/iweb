/**
 * Menu Renderer - Handles DOM rendering
 */

import { MenuTemplate } from './MenuTemplate.js';

export class MenuRenderer {
  constructor(state, config = {}) {
    this.state = state;
    this.config = config;
    this.template = new MenuTemplate(config);
    this.rafId = null;
  }

  render(container) {
    // Container is now shadowRoot
    container.innerHTML = this.template.getHTML();
    this.updateYear(container);
    this.initializeIcons(container);
    this.setupTitleUpdates(container);
  }

  updateYear(container = document) {
    const yearEl = container.querySelector('#current-year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();
  }

  initializeIcons(container = document) {
    const delay = this.config.ICON_CHECK_DELAY || 100;
    setTimeout(() => {
      const icons = container.querySelectorAll('.nav-icon use');
      icons.forEach((use) => {
        const href = use.getAttribute('href');
        if (!href) return;

        const targetId = href.substring(1);
        const target = container.querySelector(`#${targetId}`);
        const svg = use.closest('svg');
        const fallback = svg?.nextElementSibling;

        if (!target && fallback?.classList.contains('icon-fallback')) {
          svg.style.display = 'none';
          fallback.style.display = 'inline-block';
        }
      });
    }, delay);
  }

  setupTitleUpdates(container = document) {
    this.state.on('titleChange', ({ title, subtitle }) => {
      this.updateTitle(title, subtitle, container);
    });
  }

  updateTitle(title, subtitle = '', container = document) {
    const siteTitleEl = container.querySelector('#site-title');
    const siteSubtitleEl = container.querySelector('#site-subtitle');

    if (!siteTitleEl) return;

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
        siteTitleEl.textContent = title;
        siteTitleEl.style.opacity = '1';
        siteTitleEl.style.transform = 'scale(1)';

        if (siteSubtitleEl && subtitle) {
          siteSubtitleEl.textContent = subtitle;
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
