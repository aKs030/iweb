/**
 * Footer Loading System - Basis Footer-Laden
 *
 * Features:
 * - Dynamisches Laden des Footer-Inhalts
 * - Automatische Jahr-Aktualisierung
 * - Error Handling mit Fallback
 * - Performance-optimiert
 * - Accessibility-Support
 *
 * @author Abdulkerim Sesli
 * @version 2.5.0
 */

import { getElementById } from '../utils/common-utils.js';
import { initializeDayNightArtwork } from './day-night-artwork.js';

/**
 * Initialisiert das Footer-System
 */
async function initializeFooter() {
  const footerContainer = getElementById('footer-container');

  if (!footerContainer) {
    return;
  }

  try {
    await loadFooterContent(footerContainer);
    updateCurrentYear();

    // Footer-Interaktionen direkt einrichten
    setupNewsletterForm();
    setupCookieSettings();

    // Day/Night Artwork Theme Toggle initialisieren
    try {
      await initializeDayNightArtwork();
    } catch (_) {
      // Artwork-Initialisierung ist optional - bei Fehler still ignorieren
    }

    // Globale Footer API bereitstellen
    window.footerAPI = {
      showNotification
    };

    // Smooth Scrolling für interne Links im Footer
    const footerLinks = document.querySelectorAll('#site-footer a[href^="#"]');
    footerLinks.forEach((link) => {
      link.addEventListener('click', (e) => {
        const targetId = link.getAttribute('href').substring(1);
        const targetElement = getElementById(targetId);

        if (targetElement) {
          e.preventDefault();
          targetElement.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });
        }
      });
    });
  } catch (_) {
    showFallbackFooter(footerContainer);
  }
}

/**
 * Lädt den Footer-Inhalt dynamisch
 */
async function loadFooterContent(container) {
  const footerSrc =
    container.dataset.footerSrc ||
    container.getAttribute('data-footer-src') ||
    '/content/webentwicklung/footer/footer.html';

  const response = await fetch(footerSrc);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const footerHTML = await response.text();
  container.innerHTML = footerHTML;

  // ARIA-Label für bessere Accessibility
  const footer = container.querySelector('#site-footer');
  if (footer && !footer.getAttribute('aria-label')) {
    footer.setAttribute(
      'aria-label',
      'Website Footer mit Kontaktinformationen und Links'
    );
  }
}

/**
 * Aktualisiert das aktuelle Jahr automatisch
 */
function updateCurrentYear() {
  const yearElements = document.querySelectorAll(
    '#current-year, #current-year-full'
  );
  const currentYear = new Date().getFullYear();

  yearElements.forEach((element) => {
    if (element && element.textContent !== String(currentYear)) {
      element.textContent = currentYear;
    }
  });
}

/**
 * Richtet Newsletter-Anmeldung ein
 */
function setupNewsletterForm() {
  const newsletterForm = document.querySelector('.newsletter-form');

  if (!newsletterForm) return;

  newsletterForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const emailInput = newsletterForm.querySelector('.newsletter-input');
    const submitBtn = newsletterForm.querySelector('.newsletter-submit');
    const email = emailInput.value.trim();

    if (!email?.includes?.('@')) {
      showNotification(
        'Bitte geben Sie eine gültige E-Mail-Adresse ein',
        'error'
      );
      return;
    }

    // UI-Feedback
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Wird gesendet...';
    submitBtn.disabled = true;

    try {
      // Hier würde die Newsletter-API-Anfrage stehen
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Simulation

      emailInput.value = '';
      submitBtn.textContent = '✓ Angemeldet';
      showNotification('Erfolgreich für Newsletter angemeldet!', 'success');

      setTimeout(() => {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
      }, 2000);
    } catch (_) {
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
      showNotification(
        'Anmeldung fehlgeschlagen. Bitte versuchen Sie es später erneut.',
        'error'
      );
    }
  });
}

/**
 * Richtet Cookie-Einstellungen ein
 */
function setupCookieSettings() {
  const cookieBtn = document.querySelector('.cookie-settings-btn');

  if (!cookieBtn) return;

  cookieBtn.addEventListener('click', () => {
    // Hier würde ein Cookie-Banner oder Modal geöffnet werden
    showNotification('Cookie-Einstellungen werden geladen...', 'info');
  });
}

/**
 * Zeigt Benachrichtigungen an (Performance-optimiert)
 */
function showNotification(message, type = 'info') {
  // Prevent notification spam
  if (showNotification._timeout) {
    clearTimeout(showNotification._timeout);
    const existing = document.querySelector('.footer-notification');
    if (existing) existing.remove();
  }

  // Einfache Notification-Implementierung
  const notification = document.createElement('div');
  notification.className = `footer-notification footer-notification--${type}`;
  notification.textContent = message;
  notification.setAttribute('role', 'alert');
  notification.setAttribute('aria-live', 'polite');

  // Hintergrundfarbe basierend auf Typ bestimmen
  let backgroundColor;
  if (type === 'error') {
    backgroundColor = '#ff4444';
  } else if (type === 'success') {
    backgroundColor = '#44ff44';
  } else {
    backgroundColor = '#007AFF';
  }

  // Performance: CSS in einem Block setzen
  Object.assign(notification.style, {
    position: 'fixed',
    top: '20px',
    right: '20px',
    background: backgroundColor,
    color: 'white',
    padding: '1rem 1.5rem',
    borderRadius: '8px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
    zIndex: '10000',
    opacity: '0',
    transform: 'translateX(100%)',
    transition: 'all 0.3s ease',
    maxWidth: '300px',
    wordWrap: 'break-word'
  });

  document.body.appendChild(notification);

  // Animation einblenden mit RAF für Performance
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      notification.style.opacity = '1';
      notification.style.transform = 'translateX(0)';
    });
  });

  // Nach 3 Sekunden ausblenden
  showNotification._timeout = setTimeout(() => {
    notification.style.opacity = '0';
    notification.style.transform = 'translateX(100%)';
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
  toggleTheme: () => {
    const themeToggle = document.querySelector('.theme-toggle-btn');
    if (themeToggle) themeToggle.click();
  }
};

// Footer automatisch initialisieren wenn DOM bereit ist
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeFooter);
} else {
  initializeFooter();
}

export {
  initializeFooter,
  setupNewsletterForm,
  showNotification,
  updateCurrentYear
};
