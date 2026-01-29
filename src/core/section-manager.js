/**
 * Simple Section Manager
 * @version 2.0.0
 */

import { createLogger } from './logger.js';
import { fetchText } from './fetch.js';
import { fire, EVENTS } from './events.js';
import { createObserver } from './intersection-observer.js';

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

    try {
      // Try with and without .html extension
      let html;
      try {
        html = await fetchText(url);
      } catch {
        html = await fetchText(url + '.html');
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
      const observer = createObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              this.loadSection(entry.target);
            }
          });
        },
        { rootMargin: '100px' },
      );

      lazySections.forEach((section) => observer.observe(section));
    }
  }

  reinit() {
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
