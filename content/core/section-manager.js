/**
 * Simple Section Manager
 * @version 2.0.0
 */

import { createLogger } from './logger.js';
import { fetchText } from './fetch.js';
import { createObserver } from './utils.js';
import { i18n } from './i18n.js';
import { withViewTransition } from './view-transitions.js';
import {
  VIEW_TRANSITION_ROOT_CLASSES,
  VIEW_TRANSITION_TYPES,
} from './view-transition-types.js';
import { VIEW_TRANSITION_TIMINGS_MS } from './view-transition-timings.js';
const log = createLogger('SectionManager');
const SECTION_SWAP_VT_NAME = 'section-swap-target';

/**
 * @param {string} sectionId
 * @returns {string[]}
 */
const buildSectionSwapTypes = (sectionId) => {
  const raw = String(sectionId || '')
    .trim()
    .toLowerCase();
  const token = raw
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24);

  return token
    ? [
        VIEW_TRANSITION_TYPES.SECTION_SWAP,
        `${VIEW_TRANSITION_TYPES.SECTION_SWAP}-${token}`,
      ]
    : [VIEW_TRANSITION_TYPES.SECTION_SWAP];
};

export class SectionManager {
  constructor() {
    this.loadedSections = new WeakSet();
    this.loadingSections = new WeakSet();
    this._snapRestorer = null;
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
      // Note: event dispatch removed; other parts of the system should
      // rely on the centralized fire() helper if needed.
    };

    if (section.hasAttribute('data-ssr-loaded')) {
      log.debug(`Section ${section.id} loaded via Edge SSR`);
      return markLoaded();
    }

    try {
      let html;
      try {
        html = await fetchText(url.replace(/\.html$/, '') || url);
      } catch {
        html = await fetchText(url);
      }

      const htmlEl = document.documentElement;
      const wasSnapPage = htmlEl.classList.contains('snap-page');
      const previousVtName = section.style.viewTransitionName;
      section.style.viewTransitionName = SECTION_SWAP_VT_NAME;

      try {
        await withViewTransition(
          () => {
            section.replaceChildren(); // Safely clears existing DOM
            if (wasSnapPage) htmlEl.classList.remove('snap-page');

            section.insertAdjacentHTML('beforeend', html);

            const template = section.querySelector('template');
            if (template) section.appendChild(template.content.cloneNode(true));
          },
          {
            types: buildSectionSwapTypes(section.id),
            rootClasses: [VIEW_TRANSITION_ROOT_CLASSES.SECTION_SWAP],
            timeoutMs: VIEW_TRANSITION_TIMINGS_MS.SECTION_SWAP_TIMEOUT,
          },
        );
      } finally {
        if (previousVtName) {
          section.style.viewTransitionName = previousVtName;
        } else {
          section.style.removeProperty('view-transition-name');
        }
      }

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
}
