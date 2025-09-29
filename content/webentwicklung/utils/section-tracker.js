// Simple Section Tracker - Ersatz für Particle-System Section Detection

import { getElementById } from "./common-utils.js";

class SectionTracker {
  constructor() {
    this.sections = [];
    this.currentSectionId = null;
    this.observer = null;
    this.init();
  }

  init() {
    // Warte bis Sections geladen sind
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => this.setupObserver());
    } else {
      setTimeout(() => this.setupObserver(), 100);
    }

    // Re-scan bei dynamisch geladenen Sections
    document.addEventListener("section:loaded", () => {
      setTimeout(() => this.refreshSections(), 50);
    });
  }

  setupObserver() {
    this.refreshSections();

    if (!("IntersectionObserver" in window) || this.sections.length === 0) {
      return;
    }

    // Optimierte Observer-Konfiguration
    const options = {
      root: null,
      threshold: [0.1, 0.3, 0.5, 0.7],
      rootMargin: "-10% 0px -10% 0px",
    };

    this.observer = new IntersectionObserver((entries) => {
      this.handleIntersections(entries);
    }, options);

    // Alle Sections beobachten
    this.sections.forEach((section) => {
      this.observer.observe(section);
    });

    // Initial aktive Section ermitteln
    this.checkInitialSection();
  }

  refreshSections() {
    this.sections = Array.from(
      document.querySelectorAll("main .section, .section")
    ).filter((section) => section.id);

    if (this.observer) {
      // Re-observe neue Sections
      this.sections.forEach((section) => {
        this.observer.observe(section);
      });
    }
  }

  handleIntersections(entries) {
    let bestEntry = null;
    let bestRatio = 0;

    // Finde die Section mit der größten Sichtbarkeit
    entries.forEach((entry) => {
      if (entry.isIntersecting && entry.intersectionRatio > bestRatio) {
        bestRatio = entry.intersectionRatio;
        bestEntry = entry;
      }
    });

    if (bestEntry) {
      const newSectionId = bestEntry.target.id;
      if (newSectionId !== this.currentSectionId) {
        this.currentSectionId = newSectionId;
        this.dispatchSectionChange(newSectionId);
      }
    }
  }

  checkInitialSection() {
    // Fallback: Ermittele aktive Section basierend auf Scroll-Position
    const viewportCenter = window.innerHeight / 2;
    let activeSection = null;
    let bestDistance = Infinity;

    this.sections.forEach((section) => {
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
    });

    if (activeSection && activeSection.id !== this.currentSectionId) {
      this.currentSectionId = activeSection.id;
      this.dispatchSectionChange(activeSection.id);
    }
  }

  dispatchSectionChange(sectionId) {
    try {
      const sectionIndex = this.sections.findIndex((s) => s.id === sectionId);
      const detail = {
        id: sectionId,
        index: sectionIndex,
        section: getElementById(sectionId),
      };

      const event = new CustomEvent("snapSectionChange", { detail });
      window.dispatchEvent(event);
    } catch {
      // Fail silently
    }
  }

  // Public API für manuelle Section-Updates
  updateCurrentSection(sectionId) {
    if (this.sections.find((s) => s.id === sectionId)) {
      this.currentSectionId = sectionId;
      this.dispatchSectionChange(sectionId);
    }
  }
}

// Export und globale Initialisierung
const sectionTracker = new SectionTracker();
export { sectionTracker, SectionTracker };

// Global verfügbar machen für Legacy-Code
window.sectionTracker = sectionTracker;
