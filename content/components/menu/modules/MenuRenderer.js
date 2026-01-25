/**
 * Menu Renderer - Handles DOM rendering
 */

import { MenuTemplate } from './MenuTemplate.js';
import { getElementById } from '/content/utils/shared-utilities.js';

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

  setupTitleUpdates() {
    this.state.on('titleChange', ({ title, subtitle }) => {
      this.updateTitle(title, subtitle);
    });
  }

  updateTitle(title, subtitle = '') {
    const siteTitleEl = getElementById('site-title');
    const siteSubtitleEl = getElementById('site-subtitle');

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
