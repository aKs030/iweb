/**
 * Section Manager
 * @version 1.0.0
 */

import {
  createLogger,
  fetchText,
  fire,
  EVENTS,
  addListener,
  safeExecute,
} from './shared-utilities.js';
import { createObserver } from './intersection-observer.js';

const log = createLogger('SectionManager');

export class SectionManager {
  constructor() {
    this.SELECTOR = 'section[data-section-src]';
    this.loadedSections = new WeakSet();
    this.retryAttempts = new WeakMap();
    this.MAX_RETRIES = 2;
  }

  dispatchEvent(type, section, detail = {}) {
    try {
      document.dispatchEvent(
        new CustomEvent(type, {
          detail: { id: section?.id, section, ...detail },
        }),
      );
    } catch (error) {
      log.debug(`Event dispatch failed: ${type}`, error);
    }
  }

  getSectionName(section) {
    const labelId = section.getAttribute('aria-labelledby');
    if (labelId) {
      const label = document.getElementById(labelId);
      const text = label?.textContent?.trim();
      if (text) return text;
    }
    return section.id || 'Abschnitt';
  }

  getFetchCandidates(url) {
    if (url?.endsWith('.html')) {
      return [url.replace(/\.html$/, ''), url];
    } else if (url?.startsWith('/pages/')) {
      return [(url || '') + '.html', url];
    }
    return [url, (url || '') + '.html'];
  }

  async fetchSectionContent(url) {
    const fetchCandidates = this.getFetchCandidates(url);

    for (const candidate of fetchCandidates) {
      const html = await safeExecute(async () => await fetchText(candidate));
      if (html) return html;
    }

    throw new Error('Failed to fetch section content');
  }

  async loadSection(section) {
    if (this.loadedSections.has(section)) return;

    const url = section.dataset.sectionSrc;
    if (!url) {
      section.removeAttribute('aria-busy');
      return;
    }

    // Skip non-critical sections on subpages
    const isHomePage =
      (globalThis.location?.pathname || '').replace(/\/+$/g, '') === '';
    const isEager = section.dataset.eager === 'true';
    if (!isHomePage && !isEager) return;

    this.loadedSections.add(section);
    const sectionName = this.getSectionName(section);
    const attempts = this.retryAttempts.get(section) || 0;

    section.setAttribute('aria-busy', 'true');
    section.dataset.state = 'loading';

    this.dispatchEvent('section:will-load', section, { url });

    try {
      const html = await this.fetchSectionContent(url);
      section.insertAdjacentHTML('beforeend', html);

      const template = section.querySelector('template');
      if (template) {
        section.appendChild(template.content.cloneNode(true));
      }

      section
        .querySelectorAll('.section-skeleton')
        .forEach((el) => el.remove());
      section.dataset.state = 'loaded';
      section.removeAttribute('aria-busy');

      this.dispatchEvent('section:loaded', section, { state: 'loaded' });

      if (section.id === 'hero') {
        fire(EVENTS.HERO_LOADED);
      }
    } catch (error) {
      log.warn(`Section load failed: ${sectionName}`, error);

      const isTransient = /5\d\d/.test(String(error)) || !navigator.onLine;
      const shouldRetry = isTransient && attempts < this.MAX_RETRIES;

      if (shouldRetry) {
        this.retryAttempts.set(section, attempts + 1);
        this.loadedSections.delete(section);

        const delay = 300 * Math.pow(2, attempts);
        await new Promise((resolve) => setTimeout(resolve, delay));

        return this.loadSection(section);
      }

      section.dataset.state = 'error';
      section.removeAttribute('aria-busy');
      this.dispatchEvent('section:error', section, { state: 'error' });

      // Inject retry UI
      if (!section.querySelector('.section-retry')) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'section-retry';
        button.textContent = 'Erneut laden';

        const removeListener = addListener(
          button,
          'click',
          () => this.retrySection(section),
          { once: true },
        );
        button.__listenerRemovers = [removeListener];

        const wrapper = document.createElement('div');
        wrapper.className = 'section-error-box';
        wrapper.appendChild(button);
        section.appendChild(wrapper);
      }
    }
  }

  async retrySection(section) {
    section.querySelectorAll('.section-error-box').forEach((el) => el.remove());
    section.dataset.state = '';
    this.loadedSections.delete(section);
    this.retryAttempts.delete(section);
    await this.loadSection(section);
  }

  init() {
    if (this._initialized) return;
    this._initialized = true;

    const sections = Array.from(document.querySelectorAll(this.SELECTOR));
    const eagerSections = [];
    const lazySections = [];

    sections.forEach((section) => {
      if (section.dataset.eager !== undefined) {
        eagerSections.push(section);
      } else {
        lazySections.push(section);
      }
    });

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
}
