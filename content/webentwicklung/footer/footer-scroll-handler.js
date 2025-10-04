/**
 * Footer Scroll Handler - Dynamische Footer-Expansion bei letzter Sektion
 *
 * Features:
 * - Scroll-Detection für letzte Sektion ('about')
 * - Smooth Footer-Expansion/Kollaps
 * - Performance-optimiert mit Intersection Observer
 * - Event-basierte Koordination mit load-footer.js
 * - Accessibility-Support
 * - CONFIG-basierte Konfiguration (keine Magic Numbers)
 *
 * @author Abdulkerim Sesli
 * @version 1.3.0
 */

import { createLogger, getElementById } from "../shared-utilities.js";
import { updateCurrentYear } from "./load-footer.js";

const log = createLogger("footerScrollHandler");

/**
 * Konfigurationskonstanten für Footer-Scroll-Handler
 * @constant {Object} CONFIG
 * @property {number} FALLBACK_INIT_DELAY - Fallback-Init-Verzögerung wenn Event fehlt (ms)
 * @property {string} OBSERVER_ROOT_MARGIN - IntersectionObserver Root-Margin (trigger bei halber Sichtbarkeit)
 * @property {number[]} OBSERVER_THRESHOLDS - IntersectionObserver Thresholds
 * @property {number} MIN_INTERSECTION_RATIO - Minimales Intersection-Ratio für Footer-Expansion
 */
const CONFIG = {
  FALLBACK_INIT_DELAY: 100,
  OBSERVER_ROOT_MARGIN: "0px 0px -50% 0px",
  OBSERVER_THRESHOLDS: [0.1, 0.5],
  MIN_INTERSECTION_RATIO: 0.1,
};

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
    log.warn(
      "Footer nicht gefunden - Scroll Handler konnte nicht initialisiert werden"
    );
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
    rootMargin: CONFIG.OBSERVER_ROOT_MARGIN,
    threshold: CONFIG.OBSERVER_THRESHOLDS,
  };

  lastSectionObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.target.id === "footer-trigger-zone") {
        // Footer expandiert wenn Trigger-Zone sichtbar wird
        const shouldExpand =
          entry.isIntersecting &&
          entry.intersectionRatio >= CONFIG.MIN_INTERSECTION_RATIO;
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

    // Jahr in erweiterten Footer aktualisieren
    updateCurrentYear();
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

// Warte auf footer:loaded Event für bessere Koordination
document.addEventListener(
  "footer:loaded",
  () => {
    log.debug("Footer:loaded Event empfangen, starte Scroll Handler");
    initializeFooterScrollHandler();
  },
  { once: true }
);

// Fallback: Falls Event bereits gefeuert wurde, prüfe DOM
if (document.readyState !== "loading") {
  setTimeout(() => {
    if (getElementById("site-footer") && !lastSectionObserver) {
      log.debug("Footer bereits geladen, starte Scroll Handler (Fallback)");
      initializeFooterScrollHandler();
    }
  }, CONFIG.FALLBACK_INIT_DELAY);
}

// Cleanup bei Page Unload
window.addEventListener("beforeunload", cleanup);

export { cleanup, initializeFooterScrollHandler, toggleFooterExpansion };
