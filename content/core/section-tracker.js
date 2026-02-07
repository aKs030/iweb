/**
 * Section Tracker
 * Handles scroll-based navigation and section visibility tracking.
 * @version 1.0.0
 */

import { getElementById, onDOMReady } from './utils.js';
import { createLogger } from './logger.js';

const log = createLogger('SectionTracker');

const REFRESH_DELAY_MS = 50;
const SECTION_TRACKER_CONFIG = {
  threshold: [0.1, 0.3, 0.5, 0.7],
  rootMargin: '-10% 0px -10% 0px',
};

/**
 * @typedef {Object} SectionData
 * @property {number} ratio
 * @property {boolean} isIntersecting
 * @property {HTMLElement} target
 */

/**
 * Section Tracker for scroll-based navigation
 */
export class SectionTracker {
  constructor() {
    /** @type {Array<HTMLElement>} */
    this.sections = [];
    /** @type {Map<string, SectionData>} */
    this.sectionRatios = new Map();
    /** @type {string|null} */
    this.currentSectionId = null;
    /** @type {IntersectionObserver|null} */
    this.observer = null;
    /** @type {(() => void)|null} */
    this.refreshHandler = null;
  }

  init() {
    onDOMReady(() => this.setupObserver());

    // Reuse single handler for both events
    this.refreshHandler = () =>
      setTimeout(() => this.refreshSections(), REFRESH_DELAY_MS);
    document.addEventListener('section:loaded', this.refreshHandler);
    document.addEventListener('footer:loaded', this.refreshHandler);
  }

  setupObserver() {
    this.refreshSections();
    if (!window.IntersectionObserver || this.sections.length === 0) return;
    this.observer = new IntersectionObserver(
      (entries) => this.handleIntersections(entries),
      SECTION_TRACKER_CONFIG,
    );
    this.sections.forEach((section) => {
      if (this.observer) this.observer.observe(section);
    });

    // Use requestIdleCallback for initial check
    if (typeof window.requestIdleCallback === 'function') {
      requestIdleCallback(() => this.checkInitialSection(), { timeout: 1000 });
    } else {
      setTimeout(() => this.checkInitialSection(), 100);
    }
  }

  refreshSections() {
    const elements = Array.from(
      document.querySelectorAll('main .section[id], footer#site-footer[id]'),
    );

    /** @type {HTMLElement[]} */
    const newSections = [];
    for (const el of elements) {
      if (el instanceof HTMLElement && el.id) {
        newSections.push(el);
      }
    }

    // Only update if sections changed
    if (newSections.length !== this.sections.length) {
      // Unobserve old sections before re-observing
      if (this.observer) {
        this.sections.forEach((section) => {
          try {
            this.observer.unobserve(section);
          } catch {
            /* ignore */
          }
        });
      }
      this.sections = newSections;
      if (this.observer) {
        this.sections.forEach((section) => {
          if (this.observer) this.observer.observe(section);
        });
      }
    }
  }

  handleIntersections(entries) {
    let hasChanges = false;

    entries.forEach((entry) => {
      const target = /** @type {HTMLElement} */ (entry.target);
      if (target?.id) {
        const prevData = this.sectionRatios.get(target.id);
        const newData = {
          ratio: entry.intersectionRatio,
          isIntersecting: entry.isIntersecting,
          target: target,
        };

        // Only update if changed
        if (
          !prevData ||
          prevData.ratio !== newData.ratio ||
          prevData.isIntersecting !== newData.isIntersecting
        ) {
          this.sectionRatios.set(target.id, newData);
          hasChanges = true;
        }
      }
    });

    if (!hasChanges) return;

    let bestEntry = null;
    let bestRatio = 0;
    for (const section of this.sections) {
      if (!section || !section.id) continue;
      const data = this.sectionRatios.get(section.id);
      if (data && data.isIntersecting && data.ratio > bestRatio) {
        bestRatio = data.ratio;
        bestEntry = data;
      }
    }
    if (bestEntry && bestEntry.target?.id) {
      const newSectionId = bestEntry.target.id;
      if (newSectionId !== this.currentSectionId) {
        this.currentSectionId = newSectionId;
        this.dispatchSectionChange(newSectionId);
      }
    }
  }

  checkInitialSection() {
    const viewportCenter = window.innerHeight / 2;
    /** @type {HTMLElement|null} */
    let activeSection = null;
    let bestDistance = Infinity;

    for (const section of this.sections) {
      if (!section) continue;
      const rect = section.getBoundingClientRect();
      const sectionCenter = rect.top + rect.height / 2;
      const distance = Math.abs(sectionCenter - viewportCenter);
      if (
        distance < bestDistance &&
        rect.top < viewportCenter &&
        rect.bottom > viewportCenter
      ) {
        bestDistance = distance;
        activeSection = section;
      }
    }

    if (activeSection?.id && activeSection.id !== this.currentSectionId) {
      this.currentSectionId = activeSection.id;
      this.dispatchSectionChange(activeSection.id);
    }
  }

  dispatchSectionChange(sectionId) {
    try {
      const sectionIndex = this.sections.findIndex((s) => {
        if (s && typeof s.id === 'string') {
          return s.id === sectionId;
        }
        return false;
      });
      const section = getElementById(sectionId);
      const detail = {
        id: /** @type {string} */ (sectionId),
        index: sectionIndex,
        section,
      };
      window.dispatchEvent(new CustomEvent('snapSectionChange', { detail }));
      log.debug(`Section changed: ${sectionId}`);
    } catch (error) {
      log.warn('Failed to dispatch section change:', error);
    }
  }

  updateCurrentSection(sectionId) {
    const foundSection = this.sections.find((s) => {
      if (s && typeof s.id === 'string') {
        return s.id === sectionId;
      }
      return false;
    });
    if (foundSection) {
      this.currentSectionId = sectionId;
      this.dispatchSectionChange(sectionId);
    }
  }

  destroy() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    if (this.refreshHandler) {
      document.removeEventListener('section:loaded', this.refreshHandler);
      document.removeEventListener('footer:loaded', this.refreshHandler);
      this.refreshHandler = null;
    }
    this.sections = [];
    this.sectionRatios.clear();
    this.currentSectionId = null;
  }
}
