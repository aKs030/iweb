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

import { createLogger } from '../utils/logger.js';

// Logger für Footer-spezifische Meldungen
const log = createLogger ? createLogger('footer') : { 
  error: console.error.bind(console),
  warn: console.warn.bind(console),
  info: (..._args) => {} // Silent in production
};

/**
 * Initialisiert das Footer-System
 */
async function initializeFooter() {
  const footerContainer = document.getElementById('footer-container');
  
  if (!footerContainer) {
    log.warn('Footer container nicht gefunden');
    return;
  }

  try {
    await loadFooterContent(footerContainer);
    updateCurrentYear();
    setupFooterInteractions();
    log.info('Footer erfolgreich geladen');
  } catch (error) {
    log.error('Footer-Initialisierung fehlgeschlagen:', error);
    showFallbackFooter(footerContainer);
  }
}

/**
 * Lädt den Footer-Inhalt dynamisch
 */
async function loadFooterContent(container) {
  const footerSrc = container.dataset.footerSrc || 
                   container.getAttribute('data-footer-src') || 
                   '/content/webentwicklung/footer/footer.html';

  try {
    const response = await fetch(footerSrc);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const footerHTML = await response.text();
    container.innerHTML = footerHTML;
    
    // ARIA-Label für bessere Accessibility
    const footer = container.querySelector('#site-footer');
    if (footer && !footer.getAttribute('aria-label')) {
      footer.setAttribute('aria-label', 'Website Footer mit Kontaktinformationen und Links');
    }

  } catch (error) {
    log.error('Footer-Inhalt konnte nicht geladen werden:', error);
    throw error;
  }
}

/**
 * Aktualisiert das aktuelle Jahr automatisch
 */
function updateCurrentYear() {
  const yearElements = document.querySelectorAll('#current-year, #current-year-full');
  const currentYear = new Date().getFullYear();
  
  yearElements.forEach(element => {
    if (element && element.textContent !== String(currentYear)) {
      element.textContent = currentYear;
    }
  });
}

/**
 * Richtet Footer-Interaktionen ein
 */
function setupFooterInteractions() {
  // Smooth Scrolling für interne Links im Footer
  const footerLinks = document.querySelectorAll('#site-footer a[href^="#"]');
  
  footerLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      const targetId = link.getAttribute('href').substring(1);
      const targetElement = document.getElementById(targetId);
      
      if (targetElement) {
        e.preventDefault();
        targetElement.scrollIntoView({ 
          behavior: 'smooth',
          block: 'start'
        });
      }
    });
  });
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
  log.info('Fallback-Footer angezeigt');
}

/**
 * Öffentliche API für manuelle Aktualisierungen
 */
window.footerAPI = {
  updateYear: updateCurrentYear,
  reload: initializeFooter
};

// Footer automatisch initialisieren wenn DOM bereit ist
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeFooter);
} else {
  initializeFooter();
}

// Jahr jährlich automatisch aktualisieren (für Single Page Apps)
setInterval(updateCurrentYear, 60000); // Jede Minute prüfen

export { initializeFooter, updateCurrentYear };
