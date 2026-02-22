/**
 * Simple Section Manager
 * @version 2.0.0
 */

import { createLogger } from './logger.js';
import { fetchText } from './fetch.js';
import { fire, EVENTS } from './events.js';
import { createObserver } from './utils.js';
import { i18n } from '../core/i18n.js';

const log = createLogger('SectionManager');

export class SectionManager {
  constructor() {
    this.loadedSections = new WeakSet();
  }

  async loadSection(section) {
    if (this.loadedSections.has(section)) {
      log.debug(`Section already loaded: ${section.id}`);
      return;
    }

    const url = section.dataset.sectionSrc;
    if (!url) return;

    this.loadedSections.add(section);
    section.setAttribute('aria-busy', 'true');

    // Handle Edge-Side Includes (SSR) Injection
    if (section.hasAttribute('data-ssr-loaded')) {
      log.debug(`Section ${section.id} loaded via Edge SSR`);
      section.removeAttribute('aria-busy');
      i18n.translateElement(section);
      if (section.id === 'hero') {
        fire(EVENTS.HERO_LOADED);
      }
      document.dispatchEvent(
        new CustomEvent('section:loaded', { detail: { id: section.id } }),
      );
      return;
    }

    try {
      // Fetch section HTML — URL should NOT end in .html to avoid
      // Cloudflare Pretty URLs 308 redirect loops
      const cleanUrl = url.endsWith('.html') ? url.slice(0, -5) : url;
      let html;
      try {
        html = await fetchText(cleanUrl);
      } catch {
        // Fallback: try the original URL as-is
        html = await fetchText(url);
      }

      // Remove ALL existing content before inserting new content
      // This prevents duplicate content if the section was partially loaded
      const children = Array.from(section.children);
      if (children.length > 0) {
        log.debug(
          `Section ${section.id}: clearing ${children.length} existing elements`,
        );
        children.forEach((child) => child.remove());
      }

      section.insertAdjacentHTML('beforeend', html);

      const template = section.querySelector('template');
      if (template) {
        section.appendChild(template.content.cloneNode(true));
      }

      section.removeAttribute('aria-busy');

      // Translate loaded content
      i18n.translateElement(section);

      if (section.id === 'hero') {
        fire(EVENTS.HERO_LOADED);
      }

      document.dispatchEvent(
        new CustomEvent('section:loaded', { detail: { id: section.id } }),
      );
    } catch (error) {
      log.warn(`Section load failed: ${section.id}`, error);
      section.removeAttribute('aria-busy');
    }
  }

  init() {
    if (this._initialized) return;
    this._initialized = true;

    const sections = Array.from(
      document.querySelectorAll('section[data-section-src]'),
    );

    const eagerSections = sections.filter((s) => s.dataset.eager !== undefined);
    const lazySections = sections.filter((s) => s.dataset.eager === undefined);

    eagerSections.forEach((section) => this.loadSection(section));

    if (lazySections.length) {
      this._observer = createObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              if (this._observer) this._observer.unobserve(entry.target);
              this.loadSection(entry.target);
            }
          });
        },
        { rootMargin: '100px' },
      );

      lazySections.forEach((section) => this._observer.observe(section));
    }
  }

  reinit() {
    if (this._observer) {
      this._observer.disconnect();
      this._observer = null;
    }
    this._initialized = false;
    this.loadedSections = new WeakSet();
    this.init();
  }

  // Backward compatibility
  async retrySection(section) {
    this.loadedSections.delete(section);
    await this.loadSection(section);
  }
}
