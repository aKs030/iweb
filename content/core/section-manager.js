/**
 * Simple Section Manager
 * @version 2.0.0
 */

import { createLogger, fetchText, fire, EVENTS } from './shared-utilities.js';
import { createObserver } from './intersection-observer.js';

const log = createLogger('SectionManager');

export class SectionManager {
  constructor() {
    this.loadedSections = new WeakSet();
  }

  async loadSection(section) {
    if (this.loadedSections.has(section)) return;

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

      section.insertAdjacentHTML('beforeend', html);

      const template = section.querySelector('template');
      if (template) {
        section.appendChild(template.content.cloneNode(true));
      }

      section
        .querySelectorAll('.section-skeleton')
        .forEach((el) => el.remove());
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
    this.init();
  }

  // Backward compatibility
  async retrySection(section) {
    this.loadedSections.delete(section);
    await this.loadSection(section);
  }
}
