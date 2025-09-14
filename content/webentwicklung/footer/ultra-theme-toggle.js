/**
 * Ultra 3D Theme Toggle - Integration mit bestehendem Theme-System
 * Erstellt moderne 3D-Toggle-Funktionalität für das Portfolio
 */

import { createLogger } from '../utils/logger.js';
import { getElementById, throttle } from '../utils/common-utils.js';

const log = createLogger('UltraThemeToggle');

/**
 * Ultra Theme Toggle Manager
 * Verwaltet den 3D-Toggle und seine Effekte
 */
class UltraThemeToggleManager {
  constructor() {
    this.isInitialized = false;
    this.toggle = null;
    this.particleSystem = null;
    this.lightning = null;
    
    // Throttled event handlers mit Referenzen für cleanup
    this.handleVisibilityChange = throttle(this.onVisibilityChange.bind(this), 100);
    this.boundToggleClick = this.handleToggleClick.bind(this);
    this.boundToggleKeydown = this.handleToggleKeydown.bind(this);
    this.boundThemeChanged = this.onThemeChanged.bind(this);
  }

  /**
   * Initialisiert den Ultra Theme Toggle
   */
  async initialize() {
    try {
      log.debug('Initialisiere Ultra Theme Toggle...');

      // Warte auf DOM und Theme-System
      await this.waitForThemeSystem();
      
      // Hole Toggle-Elemente
      this.toggle = getElementById('ultraThemeToggle');
      this.particleSystem = getElementById('particleSystem');
      this.lightning = getElementById('lightning');

      if (!this.toggle) {
        log.warn('Ultra Theme Toggle nicht gefunden');
        return false;
      }

      // Event-Listener hinzufügen
      this.setupEventListeners();

      // Synchronisiere mit aktuellem Theme
      this.syncWithCurrentTheme();

      this.isInitialized = true;
      log.debug('Ultra Theme Toggle erfolgreich initialisiert');
      return true;

    } catch (error) {
      log.error('Fehler beim Initialisieren des Ultra Theme Toggle:', error);
      return false;
    }
  }

  /**
   * Wartet auf das Theme-System
   */
  async waitForThemeSystem() {
    let attempts = 0;
    const maxAttempts = 50;

    while (!window.themeSystem && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }

    if (!window.themeSystem) {
      throw new Error('Theme-System nicht verfügbar nach 5 Sekunden');
    }
  }

  /**
   * Event-Listener Setup
   */
  setupEventListeners() {
    // Theme-Toggle Click Handler
    this.toggle.addEventListener('click', this.boundToggleClick, { passive: false });
    this.toggle.addEventListener('keydown', this.boundToggleKeydown, { passive: false });

    // Visibility API für Performance
    document.addEventListener('visibilitychange', this.handleVisibilityChange, { passive: true });

    // Theme-System Events
    window.themeSystem?.addEventListener?.('themeChanged', this.boundThemeChanged);

    log.debug('Event-Listener für Ultra Theme Toggle eingerichtet');
  }

  /**
   * Toggle-Click Handler
   */
  async handleToggleClick(event) {
    try {
      event.preventDefault();
      
      if (this.toggle.dataset.processing === 'true') return;
      this.toggle.dataset.processing = 'true';

      // Erstelle Partikel-Effekt
      const rect = this.toggle.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      this.createMagicParticles(x, y);

      // Lightning-Effekt
      this.triggerLightningFlash();

      // Toggle Theme über das globale System
      const newTheme = window.themeSystem?.toggleTheme?.();
      if (newTheme) {
        log.debug('Theme gewechselt zu:', newTheme);
      } else {
        log.warn('Theme-System nicht verfügbar für Toggle');
      }

      // Haptic-Feedback-Simulation
      this.simulateHapticFeedback();

      // Processing-Flag nach kurzer Verzögerung entfernen
      setTimeout(() => {
        this.toggle.dataset.processing = 'false';
      }, 800);

    } catch (error) {
      log.error('Fehler beim Theme-Toggle:', error);
      this.toggle.dataset.processing = 'false';
    }
  }

  /**
   * Keyboard Handler für Accessibility
   */
  handleToggleKeydown(event) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      // Simuliere Koordinaten für konsistente Partikel-Effekte
      const rect = this.toggle.getBoundingClientRect();
      const syntheticEvent = {
        ...event,
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2,
        preventDefault: () => {}
      };
      this.handleToggleClick(syntheticEvent);
    }
  }

  /**
   * Erstelle magische Partikel beim Klick
   */
  createMagicParticles(x, y) {
    if (!this.particleSystem) return;

    for (let i = 0; i < 12; i++) {
      const particle = document.createElement('div');
      particle.className = 'magic-particle';
      particle.style.left = x + 'px';
      particle.style.top = y + 'px';
      particle.style.setProperty('--dx', (Math.random() - 0.5) * 60 + 'px');
      particle.style.animation = 'particle-rise 1s ease-out forwards';
      particle.style.animationDelay = (i * 0.05) + 's';
      
      this.particleSystem.appendChild(particle);

      // Auto-cleanup
      setTimeout(() => {
        if (particle.parentNode) {
          particle.remove();
        }
      }, 1000);
    }
  }

  /**
   * Lightning-Flash-Effekt
   */
  triggerLightningFlash() {
    if (!this.lightning) return;

    this.lightning.classList.add('flash');
    setTimeout(() => {
      this.lightning.classList.remove('flash');
    }, 300);
  }

  /**
   * Haptic-Feedback-Simulation
   */
  simulateHapticFeedback() {
    this.toggle.style.transform = 'scale(0.95)';
    setTimeout(() => {
      this.toggle.style.transform = '';
    }, 150);
  }

  /**
   * Synchronisiert mit aktuellem Theme
   */
  syncWithCurrentTheme() {
    if (!window.themeSystem) return;

    const currentTheme = window.themeSystem.getCurrentTheme();
    log.debug('Synchronisiere mit aktuellem Theme:', currentTheme);
    
    // Theme-Attribute setzen für CSS-Selektoren
    document.documentElement.setAttribute('data-theme', currentTheme);
  }

  /**
   * Theme-Changed Event Handler
   */
  onThemeChanged(event) {
    const newTheme = event?.detail?.theme;
    if (newTheme) {
      log.debug('Theme geändert zu:', newTheme);
      
      // CSS data-theme Attribut aktualisieren
      document.documentElement.setAttribute('data-theme', newTheme);
    }
  }

  /**
   * Visibility-Change Handler für Performance
   */
  onVisibilityChange() {
    if (!this.toggle) return;
    
    const isHidden = document.hidden;
    const toggleWrapper = this.toggle.closest('.ultra-theme-toggle-wrapper');
    
    if (toggleWrapper) {
      const animations = toggleWrapper.querySelectorAll('[style*="animation"]');
      animations.forEach(el => {
        el.style.animationPlayState = isHidden ? 'paused' : 'running';
      });
    }
  }

  /**
   * Cleanup-Methode
   */
  destroy() {
    // Event-Listener entfernen
    if (this.toggle) {
      this.toggle.removeEventListener('click', this.boundToggleClick);
      this.toggle.removeEventListener('keydown', this.boundToggleKeydown);
    }

    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    window.themeSystem?.removeEventListener?.('themeChanged', this.boundThemeChanged);

    // Referenzen löschen
    this.toggle = null;
    this.particleSystem = null;
    this.lightning = null;

    this.isInitialized = false;
    log.debug('Ultra Theme Toggle zerstört');
  }
}

// Globale Instanz erstellen und exportieren
const ultraThemeToggleState = {
  manager: null
};

/**
 * Initialisiert den Ultra Theme Toggle
 */
export async function initializeUltraThemeToggle() {
  if (ultraThemeToggleState.manager) {
    log.warn('Ultra Theme Toggle bereits initialisiert');
    return ultraThemeToggleState.manager;
  }

  ultraThemeToggleState.manager = new UltraThemeToggleManager();
  const success = await ultraThemeToggleState.manager.initialize();
  
  if (!success) {
    ultraThemeToggleState.manager = null;
    throw new Error('Fehler beim Initialisieren des Ultra Theme Toggle');
  }

  return ultraThemeToggleState.manager;
}

/**
 * Globale API für Ultra Theme Toggle
 */
window.ultraThemeToggle = {
  initialize: initializeUltraThemeToggle,
  getInstance: () => ultraThemeToggleState.manager
};

export default ultraThemeToggleState;
