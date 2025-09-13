/**
 * Theme-Integration für Footer - Verbindet Footer mit globalem Theme-System
 * 
 * @author Abdulkerim Sesli
 * @version 1.0.0
 */

import { createLogger } from '../utils/logger.js';

const log = createLogger('footer-theme');

/**
 * Integriert Footer Theme-Toggle mit globalem Theme-System
 */
export function integrateFooterTheme() {
  const themeToggle = document.querySelector('.theme-toggle-btn');
  
  if (!themeToggle) {
    log.warn('Theme-Toggle Button nicht gefunden');
    return;
  }
  
  const themeIcon = themeToggle.querySelector('.theme-icon');
  const themeText = themeToggle.querySelector('.theme-text');
  
  // Warten bis globales Theme-System verfügbar ist
  const waitForThemeSystem = () => {
    if (window.themeSystem) {
      // Initiale UI aktualisieren
      const currentTheme = window.themeSystem.getCurrentTheme();
      updateThemeUI(currentTheme, themeIcon, themeText);
      
      // Click-Handler für Theme-Toggle
      themeToggle.addEventListener('click', handleThemeToggle, { passive: true });
      
      // Theme-Change Listener für externe Änderungen
      document.addEventListener('themeChanged', (e) => {
        updateThemeUI(e.detail.theme, themeIcon, themeText);
      });
      
      log.debug('Footer Theme-Toggle mit globalem System verbunden');
    } else {
      // Retry in 50ms if theme system not ready yet
      setTimeout(waitForThemeSystem, 50);
    }
  };
  
  waitForThemeSystem();
}

/**
 * Behandelt Theme-Toggle Klicks
 */
function handleThemeToggle() {
  const themeToggle = document.querySelector('.theme-toggle-btn');
  
  // Prevent multiple rapid clicks
  if (themeToggle.dataset.processing === 'true') return;
  themeToggle.dataset.processing = 'true';
  
  const newTheme = window.themeSystem.toggleTheme();
  
  // Notification anzeigen (Footer-spezifisch)
  if (window.footerAPI?.showNotification) {
    window.footerAPI.showNotification(
      `${newTheme === 'dark' ? 'Dark' : 'Light'} Mode aktiviert`, 
      'info'
    );
  }
  
  log.info(`Theme manuell zu ${newTheme} gewechselt`);
  
  // Reset processing flag after animation
  setTimeout(() => {
    themeToggle.dataset.processing = 'false';
  }, 300);
}

/**
 * Aktualisiert Theme-UI
 */
function updateThemeUI(theme, icon, text) {
  if (icon && text) {
    icon.textContent = theme === 'dark' ? '☀️' : '🌙';
    text.textContent = theme === 'dark' ? 'Light Mode' : 'Dark Mode';
  }
}