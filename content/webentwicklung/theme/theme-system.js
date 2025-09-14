/**
 * Theme System - Globale Theme-Initialisierung
 * 
 * Features:
 * - Automatische Theme-Erkennung basierend auf System-Präferenzen
 * - localStorage-Persistierung für Benutzerpräferenzen
 * - Smooth Transitions zwischen Themes
 * - FOUC (Flash of Unstyled Content) Vermeidung
 * 
 * @author Abdulkerim Sesli
 * @version 1.0.0
 */

import { createLogger } from '../utils/logger.js';

const log = createLogger('theme-system');

/**
 * Initialisiert das globale Theme-System
 * Muss so früh wie möglich geladen werden um FOUC zu vermeiden
 */
function initializeGlobalTheme() {
  // Theme-Transition CSS hinzufügen für smooth Übergänge
  const transitionCSS = `
    *, *::before, *::after {
      transition: 
        background-color 0.3s cubic-bezier(0.4, 0, 0.2, 1),
        border-color 0.3s cubic-bezier(0.4, 0, 0.2, 1),
        color 0.3s cubic-bezier(0.4, 0, 0.2, 1),
        fill 0.3s cubic-bezier(0.4, 0, 0.2, 1),
        stroke 0.3s cubic-bezier(0.4, 0, 0.2, 1),
        opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1),
        box-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1),
        transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    
    /* Specific theme transition overrides */
    .theme-transition-disabled * {
      transition: none !important;
    }
  `;
  
  // CSS in den Head einfügen
  const style = document.createElement('style');
  style.textContent = transitionCSS;
  document.head.appendChild(style);
  
  // Theme basierend auf localStorage oder System-Präferenz setzen
  const savedTheme = localStorage.getItem('theme');
  let initialTheme;
  
  if (savedTheme && (savedTheme === 'light' || savedTheme === 'dark')) {
    initialTheme = savedTheme;
    log.info(`Theme aus localStorage geladen: ${initialTheme}`);
  } else {
    // System-Präferenz prüfen
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    initialTheme = prefersDark ? 'dark' : 'light';
    localStorage.setItem('theme', initialTheme);
    log.info(`Theme basierend auf System-Präferenz gesetzt: ${initialTheme}`);
  }
  
  // Theme sofort anwenden (vor DOM-Ready um FOUC zu vermeiden)
  document.documentElement.setAttribute('data-theme', initialTheme);
  
  // Theme-Meta-Tag für Browser-UI aktualisieren
  updateThemeMetaTags(initialTheme);
  
  log.info(`Globales Theme-System initialisiert: ${initialTheme}`);
}

/**
 * Aktualisiert Browser-Meta-Tags für Theme
 */
function updateThemeMetaTags(theme) {
  const themeColor = theme === 'dark' ? '#0a0a0a' : '#ffffff';
  const statusBarStyle = theme === 'dark' ? 'black-translucent' : 'default';
  
  // Theme-Color Meta-Tag
  let themeColorMeta = document.querySelector('meta[name="theme-color"]');
  if (themeColorMeta) {
    themeColorMeta.setAttribute('content', themeColor);
  } else {
    themeColorMeta = document.createElement('meta');
    themeColorMeta.setAttribute('name', 'theme-color');
    themeColorMeta.setAttribute('content', themeColor);
    document.head.appendChild(themeColorMeta);
  }
  
  // Apple Status Bar Style
  const statusBarMeta = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
  if (statusBarMeta) {
    statusBarMeta.setAttribute('content', statusBarStyle);
  }
  
  log.debug(`Meta-Tags für ${theme} Theme aktualisiert`);
}

/**
 * Programmatischer Theme-Wechsel
 * @param {string} newTheme - 'light' oder 'dark'
 * @param {boolean} saveToStorage - Ob in localStorage gespeichert werden soll
 */
/**
 * Theme-Validierung
 */
function validateTheme(theme) {
  return ['dark', 'light'].includes(theme) ? theme : 'dark';
}

/**
 * Setzt ein Theme und speichert es
 */
function setTheme(theme) {
  const validatedTheme = validateTheme(theme);
  
  document.documentElement.setAttribute('data-theme', validatedTheme);
  localStorage.setItem('theme', validatedTheme);
  localStorage.setItem('theme-user-set', Date.now().toString());
  
  // Event für Theme-Änderung dispatchen
  const event = new CustomEvent('themeChanged', {
    detail: { theme: validatedTheme, source: 'manual' }
  });
  document.dispatchEvent(event);
  
  log.info(`Theme zu ${validatedTheme} gesetzt`);
  return validatedTheme;
}

/**
 * Aktuelles Theme abrufen
 */
function getCurrentTheme() {
  return document.documentElement.getAttribute('data-theme') || 'dark';
}

/**
 * Theme zwischen light und dark togglen
 */
function toggleTheme() {
  const currentTheme = getCurrentTheme();
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  return setTheme(newTheme);
}

/**
 * System Theme Change Listener einrichten
 */
function setupSystemThemeListener() {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  
  mediaQuery.addEventListener('change', (e) => {
    const lastUserChange = localStorage.getItem('theme-user-set');
    const now = Date.now();
    
    // Nur automatisch wechseln wenn der User nicht vor kurzem manuell gewechselt hat
    if (!lastUserChange || (now - parseInt(lastUserChange)) > 300000) { // 5 Minuten
      const systemTheme = e.matches ? 'dark' : 'light';
      setTheme(systemTheme);
      log.info(`Theme automatisch gewechselt zu: ${systemTheme} (System-Präferenz)`);
    } else {
      log.debug('Automatischer Theme-Wechsel übersprungen (User-Präferenz aktiv)');
    }
  });
  
  log.info('System Theme Change Listener aktiviert');
}

/**
 * Öffentliche API
 */
window.themeSystem = {
  setTheme,
  getCurrentTheme,
  toggleTheme,
  updateThemeMetaTags
};

// Theme-System sofort initialisieren (blocking)
initializeGlobalTheme();

// System-Listener nach DOM-Load einrichten
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupSystemThemeListener);
} else {
  setupSystemThemeListener();
}

// Auto-initialisierung beim Laden der Seite
document.addEventListener('DOMContentLoaded', initializeGlobalTheme);

// API für globalen Zugriff
window.themeSystem = {
  setTheme,
  toggleTheme,
  getCurrentTheme: () => getCurrentTheme()
};

export { 
  initializeGlobalTheme, 
  setTheme, 
  getCurrentTheme, 
  toggleTheme, 
  updateThemeMetaTags 
};