/**
 * Simple Section Manager
 * @version 2.0.0
 */

import { createLogger } from './logger.js';
import { fetchText } from './fetch.js';
import { fire, EVENTS } from './events.js';
import { createObserver } from './utils.js';
import { i18n } from './i18n.js';

const log = createLogger('SectionManager');

export class SectionManager {
  constructor() {
    this.loadedSections = new WeakSet();
    this.loadingSections = new WeakSet();
  }

  async loadSection(section) {
    if (this.loadedSections.has(section) || this.loadingSections.has(section))
      return;

    const url = section.dataset.sectionSrc;
    if (!url) return;

    this.loadingSections.add(section);
    section.setAttribute('aria-busy', 'true');

    const markLoaded = () => {
      section.removeAttribute('aria-busy');
      this.loadedSections.add(section);
      this.loadingSections.delete(section);
      i18n.translateElement(section);
      if (section.id === 'hero') fire(EVENTS.HERO_LOADED);
      document.dispatchEvent(
        new CustomEvent('section:loaded', { detail: { id: section.id } }),
      );
    };

    if (section.hasAttribute('data-ssr-loaded')) {
      log.debug(`Section ${section.id} loaded via Edge SSR`);
      return markLoaded();
    }

    try {
      let html;
      try {
        html = await fetchText(url.endsWith('.html') ? url.slice(0, -5) : url);
      } catch {
        html = await fetchText(url);
      }

      section.replaceChildren(); // Safely clears existing DOM

      const htmlEl = document.documentElement;
      const wasSnapPage = htmlEl.classList.contains('snap-page');
      if (wasSnapPage) htmlEl.classList.remove('snap-page');

      section.insertAdjacentHTML('beforeend', html);

      const template = section.querySelector('template');
      if (template) section.appendChild(template.content.cloneNode(true));

      if (wasSnapPage) {
        clearTimeout(this._snapRestorer);
        this._snapRestorer = setTimeout(
          () => htmlEl.classList.add('snap-page'),
          150,
        );
      }

      markLoaded();
    } catch (error) {
      log.warn(`Section load failed: ${section.id}`, error);
      this.loadingSections.delete(section);
      this.loadedSections.delete(section);
      section.removeAttribute('aria-busy');
    }
  }

  init() {
    if (this._initialized) return;
    this._initialized = true;

    document
      .querySelectorAll('section[data-section-src]')
      .forEach((section) => {
        if (section.dataset.eager !== undefined) {
          this.loadSection(section);
        } else {
          this._observer ??= createObserver(
            (entries, obs) => {
              entries.forEach((entry) => {
                if (entry.isIntersecting) {
                  obs.unobserve(entry.target);
                  this.loadSection(entry.target);
                }
              });
            },
            { rootMargin: '100px' },
          );
          this._observer.observe(section);
        }
      });
  }

  reinit() {
    this._observer?.disconnect();
    this._observer = null;
    this._initialized = false;
    this.loadedSections = new WeakSet();
    this.loadingSections = new WeakSet();
    this.init();
  }

  async retrySection(section) {
    this.loadedSections.delete(section);
    this.loadingSections.delete(section);
    await this.loadSection(section);
  }
}
