/**
 * Footer Loading System - Basis Footer-Laden
 *
 * Features:
 * - Dynamisches Laden des Footer-Inhalts
 * - Automatische Jahr-Aktualisierung
 * - Error Handling mit Fallback
 * - Performance-optimiert (Event Delegation)
 * - Event-basierte Koordination (footer:loaded)
 * - Accessibility-Support
 *
 * @author Abdulkerim Sesli
 * @version 2.6.0
 */

// ===== Shared Utilities Import =====
import { createLogger, getElementById } from "../shared-utilities.js";

import { initializeDayNightArtwork } from "./day-night-artwork.js";

const log = createLogger("loadFooter");

/**
 * Initialisiert das Footer-System
 */
async function initializeFooter() {
  const footerContainer = getElementById("footer-container");

  if (!footerContainer) {
    log.warn("Footer Container nicht gefunden");
    return;
  }

  try {
    log.debug("Initialisiere Footer");
    await loadFooterContent(footerContainer);
    updateCurrentYear();

    // Footer-Interaktionen direkt einrichten
    setupNewsletterForm();
    setupCookieSettings();

    // Day/Night Artwork Theme Toggle initialisieren
    try {
      await initializeDayNightArtwork();
    } catch (artworkError) {
      // Artwork-Initialisierung ist optional - bei Fehler still ignorieren
      log.debug("Day/Night Artwork nicht geladen:", artworkError.message);
    }

    log.info("Footer erfolgreich initialisiert");

    // Fire footer:loaded Event für andere Module (z.B. footer-resizer)
    document.dispatchEvent(new CustomEvent("footer:loaded", {
      detail: { footerId: "site-footer" }
    }));

    // Smooth Scrolling für interne Links im Footer (Event Delegation)
    const footer = getElementById("site-footer");
    if (footer) {
      footer.addEventListener("click", (e) => {
        const link = e.target.closest('a[href^="#"]');
        if (!link) return;

        const targetId = link.getAttribute("href").substring(1);
        const targetElement = getElementById(targetId);

        if (targetElement) {
          e.preventDefault();
          targetElement.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }
      });
    }
  } catch (error) {
    log.error("Fehler beim Initialisieren des Footers:", error);
    showFallbackFooter(footerContainer);
  }
}

/**
 * Lädt den Footer-Inhalt dynamisch
 */
async function loadFooterContent(container) {
  const footerSrc =
    container.dataset.footerSrc ||
    container.getAttribute("data-footer-src") ||
    "/content/webentwicklung/footer/footer.html";

  log.debug(`Lade Footer von: ${footerSrc}`);

  const response = await fetch(footerSrc);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const footerHTML = await response.text();
  container.innerHTML = footerHTML;

  log.debug("Footer HTML erfolgreich geladen");

  // ARIA-Label für bessere Accessibility
  const footer = container.querySelector("#site-footer");
  if (footer && !footer.getAttribute("aria-label")) {
    footer.setAttribute(
      "aria-label",
      "Website Footer mit Kontaktinformationen und Links"
    );
  }
}

/**
 * Aktualisiert das aktuelle Jahr automatisch
 */
function updateCurrentYear() {
  const currentYear = new Date().getFullYear();
  const yearElements = document.querySelectorAll(
    "#current-year, #current-year-full"
  );

  yearElements.forEach((element) => {
    if (element?.textContent !== String(currentYear)) {
      element.textContent = currentYear;
    }
  });
}

/**
 * Richtet Newsletter-Anmeldung ein
 */
function setupNewsletterForm() {
  const newsletterForm = document.querySelector(".newsletter-form-enhanced");

  if (!newsletterForm) return;

  newsletterForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const emailInput = newsletterForm.querySelector(
      ".newsletter-input-enhanced"
    );
    const submitBtn = newsletterForm.querySelector(
      ".newsletter-submit-enhanced"
    );
    const email = emailInput.value.trim();

    if (!email?.includes?.("@")) {
      showNotification(
        "Bitte geben Sie eine gültige E-Mail-Adresse ein",
        "error"
      );
      return;
    }

    // UI-Feedback
    const originalText = submitBtn.textContent;
    submitBtn.textContent = "Wird gesendet...";
    submitBtn.disabled = true;

    try {
      // Hier würde die Newsletter-API-Anfrage stehen
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Simulation

      emailInput.value = "";
      submitBtn.textContent = "✓ Angemeldet";
      showNotification("Erfolgreich für Newsletter angemeldet!", "success");

      setTimeout(() => {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
      }, 2000);
    } catch {
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
      showNotification(
        "Anmeldung fehlgeschlagen. Bitte versuchen Sie es später erneut.",
        "error"
      );
    }
  });
}

/**
 * Richtet Cookie-Einstellungen ein
 */
function setupCookieSettings() {
  const cookieBtn = document.querySelector(".footer-cookie-btn");

  if (!cookieBtn) return;

  cookieBtn.addEventListener("click", () => {
    // Hier würde ein Cookie-Banner oder Modal geöffnet werden
    showNotification("Cookie-Einstellungen werden geladen...", "info");
  });
}

/**
 * Zeigt Benachrichtigungen an (Performance-optimiert)
 */
function showNotification(message, type = "info") {
  // Prevent notification spam
  if (showNotification._timeout) {
    clearTimeout(showNotification._timeout);
    const existing = document.querySelector(".footer-notification");
    if (existing) existing.remove();
  }

  // Hintergrundfarbe basierend auf Typ bestimmen
  const colorMap = {
    error: "#ff4444",
    success: "#44ff44",
    info: "#007AFF",
  };
  const backgroundColor = colorMap[type] || colorMap.info;

  // Notification-Element erstellen
  const notification = document.createElement("div");
  notification.className = `footer-notification footer-notification--${type}`;
  notification.textContent = message;
  notification.setAttribute("role", "alert");
  notification.setAttribute("aria-live", "polite");

  // Performance: CSS in einem Block setzen
  Object.assign(notification.style, {
    position: "fixed",
    top: "20px",
    right: "20px",
    background: backgroundColor,
    color: "white",
    padding: "1rem 1.5rem",
    borderRadius: "8px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
    zIndex: "10000",
    opacity: "0",
    transform: "translateX(100%)",
    transition: "all 0.3s ease",
    maxWidth: "300px",
    wordWrap: "break-word",
  });

  document.body.appendChild(notification);

  // Animation einblenden mit RAF für Performance
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      notification.style.opacity = "1";
      notification.style.transform = "translateX(0)";
    });
  });

  // Nach 3 Sekunden ausblenden
  showNotification._timeout = setTimeout(() => {
    notification.style.opacity = "0";
    notification.style.transform = "translateX(100%)";
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 300);
  }, 3000);
}

/**
 * Zeigt einen Fallback-Footer bei Fehlern
 */
function showFallbackFooter(container) {
  const currentYear = new Date().getFullYear();

  const fallbackHTML = `
    <footer id="site-footer" class="site-footer-fixed" role="contentinfo">
      <div class="footer-minimized">
        <p class="footer-copyright-minimal">
          &copy; ${currentYear} 
          <a href="https://abdulkerimsesli.de">Abdulkerim Sesli</a>. 
          Alle Rechte vorbehalten.
        </p>
      </div>
    </footer>
  `;

  container.innerHTML = fallbackHTML;
}

/**
 * Öffentliche API für manuelle Aktualisierungen
 */
window.footerAPI = {
  updateYear: updateCurrentYear,
  reload: initializeFooter,
  showNotification,
};

// Footer automatisch initialisieren wenn DOM bereit ist
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeFooter);
} else {
  initializeFooter();
}

export {
  initializeFooter,
  setupNewsletterForm,
  showNotification,
  updateCurrentYear,
};
