/**
 * Section Tracker (Refactored for Modern Scroll Snap)
 * Handles section visibility tracking and syncs with ScrollNav.
 * @version 2.0.0
 */

import { getElementById, onDOMReady, TimerManager } from './utils.js';
import { createLogger } from './logger.js';

const log = createLogger('SectionTracker');

export class SectionTracker {
  constructor() {
    this.sections = [];
    this.currentSectionId = null;
    this.observer = null;
    this.timers = new TimerManager('SectionTracker');
  }

  init() {
    onDOMReady(() => this.setupObserver());
    // Listen for dynamically loaded sections
    document.addEventListener('section:loaded', () => this.setupObserver());
  }

  setupObserver() {
    if (this.observer) this.observer.disconnect();

    this.sections = Array.from(document.querySelectorAll('.scroll-section'));
    if (this.sections.length === 0) return;

    const options = {
      root: null, // viewport
      threshold: 0.5, // trigger when 50% visible
    };

    this.observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && entry.target.id !== this.currentSectionId) {
          this.currentSectionId = entry.target.id;
          this.dispatchSectionChange(this.currentSectionId);
        }
      });
    }, options);

    this.sections.forEach((section) => this.observer.observe(section));
  }

  dispatchSectionChange(sectionId) {
    try {
      const sectionIndex = this.sections.findIndex((s) => s.id === sectionId);
      const section = getElementById(sectionId);
      const detail = {
        id: sectionId,
        index: sectionIndex,
        section,
      };
      window.dispatchEvent(new CustomEvent('snapSectionChange', { detail }));
      log.debug(`Section changed: ${sectionId}`);
    } catch (error) {
      log.warn('Failed to dispatch section change:', error);
    }
  }

  destroy() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    this.timers.clearAll();
  }
}
