/**
 * Footer Scroll Handler - Dynamische Footer-Expansion bei letzter Sektion
 *
 * Features:
 * - Scroll-Detection für letzte Sektion ('about')
 * - Smooth Footer-Expansion/Kollaps
 * - Performance-optimiert mit Intersection Observer
 * - Accessibility-Support
 *
 * @author Abdulkerim Sesli
 * @version 1.0.0
 */

import { getElementById } from "../shared-utilities.js";

// Footer-Zustand
let footerExpanded = false;
let lastSectionObserver = null;

/**
 * Initialisiert das Footer-Scroll-System
 */
function initializeFooterScrollHandler() {
  // Warten bis Footer geladen ist
  const checkFooterReady = () => {
    const footer = getElementById("site-footer");
    if (footer) {
      setupLastSectionObserver();
    } else {
      // Nochmal nach 100ms versuchen
      setTimeout(checkFooterReady, 100);
    }
  };

  checkFooterReady();
}

/**
 * Richtet den Intersection Observer für die Footer-Trigger-Zone ein
 * Footer expandiert wenn die Trigger-Zone erreicht wird
 */
function setupLastSectionObserver() {
  const triggerZone = getElementById("footer-trigger-zone");
  const footer = getElementById("site-footer");

  if (!triggerZone || !footer) {
    return;
  }

  // Observer-Optionen - Trigger wenn Zone sichtbar wird
  const observerOptions = {
    root: null,
    rootMargin: "0px 0px -50% 0px", // Trigger wenn Zone zur Hälfte sichtbar ist
    threshold: [0.1, 0.5],
  };

  lastSectionObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.target.id === "footer-trigger-zone") {
        // Footer expandiert wenn Trigger-Zone sichtbar wird
        const shouldExpand =
          entry.isIntersecting && entry.intersectionRatio >= 0.1;
        toggleFooterExpansion(shouldExpand);
      }
    });
  }, observerOptions);

  lastSectionObserver.observe(triggerZone);
}

/**
 * Expandiert oder kollabiert den Footer
 */
function toggleFooterExpansion(shouldExpand) {
  const footer = getElementById("site-footer");
  const { body } = document;
  const footerMinimized = footer?.querySelector(".footer-minimized");
  const footerMaximized = footer?.querySelector(".footer-maximized");

  if (!footer || !footerMinimized || !footerMaximized) {
    return;
  }

  if (shouldExpand && !footerExpanded) {
    // Footer expandieren
    footer.classList.add("footer-expanded");
    body.classList.add("footer-expanded");
    footerMaximized.classList.remove("footer-hidden");
    footerExpanded = true;

    // Jahr in erweiterten Footer aktualisieren - nutze globale API
    if (window.footerAPI?.updateYear) {
      window.footerAPI.updateYear();
    }
  } else if (!shouldExpand && footerExpanded) {
    // Footer kollabieren
    footer.classList.remove("footer-expanded");
    body.classList.remove("footer-expanded");
    footerMaximized.classList.add("footer-hidden");
    footerExpanded = false;
  }
}

/**
 * Cleanup-Funktion für Observer
 */
function cleanup() {
  if (lastSectionObserver) {
    lastSectionObserver.disconnect();
    lastSectionObserver = null;
  }
}

/**
 * Öffentliche API
 */
window.footerScrollAPI = {
  expand: () => toggleFooterExpansion(true),
  collapse: () => toggleFooterExpansion(false),
  toggle: () => toggleFooterExpansion(!footerExpanded),
  isExpanded: () => footerExpanded,
  cleanup,
};

// System automatisch initialisieren
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    setTimeout(initializeFooterScrollHandler, 500); // Nach Footer-Load warten
  });
} else {
  setTimeout(initializeFooterScrollHandler, 500);
}

// Cleanup bei Page Unload
window.addEventListener("beforeunload", cleanup);

export { cleanup, initializeFooterScrollHandler, toggleFooterExpansion };
