/**
 * Footer Scroll Handler - Dynamische Footer-Expansion bei letzter Sektion
 *
 * Features:
 * - Scroll-Detection für letzte Sektion ('about')
 * - Smooth Footer-Expansion/Kollaps
 * - Performance-optimiert mit Intersection Observer
 * - Event-basierte Koordination mit load-footer.js
 * - Accessibility-Support
 *
 * @author Abdulkerim Sesli
 * @version 1.2.0
 */

import { createLogger, getElementById } from "../shared-utilities.js";

const log = createLogger("footerScrollHandler");

// Footer-Zustand
let footerExpanded = false;
let lastSectionObserver = null;

/**
 * Initialisiert das Footer-Scroll-System
 */
function initializeFooterScrollHandler() {
  log.debug("Initialisiere Footer Scroll Handler");
  
  const footer = getElementById("site-footer");
  if (footer) {
    setupLastSectionObserver();
    log.info("Footer Scroll Handler erfolgreich initialisiert");
  } else {
    log.warn("Footer nicht gefunden - Scroll Handler konnte nicht initialisiert werden");
  }
}

/**
 * Richtet den Intersection Observer für die Footer-Trigger-Zone ein
 * Footer expandiert wenn die Trigger-Zone erreicht wird
 */
function setupLastSectionObserver() {
  const triggerZone = getElementById("footer-trigger-zone");
  const footer = getElementById("site-footer");

  if (!triggerZone || !footer) {
    log.warn("Footer-Trigger-Zone oder Footer nicht gefunden");
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
  log.debug("Intersection Observer für Footer-Trigger-Zone eingerichtet");
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

// Warte auf footer:loaded Event für bessere Koordination
document.addEventListener("footer:loaded", () => {
  log.debug("Footer:loaded Event empfangen, starte Scroll Handler");
  initializeFooterScrollHandler();
}, { once: true });

// Fallback: Falls Event bereits gefeuert wurde, prüfe DOM
if (document.readyState !== "loading") {
  setTimeout(() => {
    if (document.getElementById("site-footer") && !lastSectionObserver) {
      log.debug("Footer bereits geladen, starte Scroll Handler (Fallback)");
      initializeFooterScrollHandler();
    }
  }, 100);
}

// Cleanup bei Page Unload
window.addEventListener("beforeunload", cleanup);

export { cleanup, initializeFooterScrollHandler, toggleFooterExpansion };
