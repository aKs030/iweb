/**
 * Day/Night Artwork Theme Toggle - Integration mit bestehendem Theme-System
 * Erstellt wunderschönes rundes Mini-Kunstwerk für Theme-Wechsel
 */

import { getElementById, throttle } from '../utils/common-utils.js';
import { createLogger } from '../utils/logger.js';
import { createEventManager, onVisibilityChange } from '../utils/event-management.js';

const log = createLogger('dayNightArtwork');


/**
 * Day/Night Artwork Manager
 * Verwaltet das runde Mini-Kunstwerk und seine Animationen
 */
class DayNightArtworkManager {
  constructor() {
    this.isInitialized = false;
    this.artwork = null;
    this.skyCanvas = null;
    this.isTransitioning = false;
    
    // Event Manager für systematisches Event-Management
    this.eventManager = createEventManager('dayNightArtwork');
    
    // Throttled event handlers mit Referenzen für cleanup
    this.handleVisibilityChange = throttle(this.onVisibilityChange.bind(this), 100);
    this.boundToggleClick = this.handleToggleClick.bind(this);
    this.boundToggleKeydown = this.handleToggleKeydown.bind(this);
    this.boundThemeChanged = this.onThemeChanged.bind(this);
  }

  /**
   * Initialisiert das Day/Night Artwork
   */
  async initialize() {
    try {

      // Warte auf DOM und Theme-System
      await this.waitForThemeSystem();
      
      // Hole Artwork-Elemente
      this.artwork = getElementById('dayNightToggle');
      this.skyCanvas = this.artwork?.querySelector('.sky-canvas');

      if (!this.artwork) {
        return false;
      }

      // Event-Listener hinzufügen
      this.setupEventListeners();

      // Synchronisiere mit aktuellem Theme
      this.syncWithCurrentTheme();

      // Starte natürliche Animationen
      this.startNaturalAnimations();

      this.isInitialized = true;
      return true;

    } catch (error) {
      log.error('Initialisierung fehlgeschlagen:', error);
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
   * Event-Listener Setup mit EventManager
   */
  setupEventListeners() {
    // Theme-Toggle Events
    this.eventManager.add(this.artwork, 'click', this.boundToggleClick, { passive: false });
    this.eventManager.add(this.artwork, 'keydown', this.boundToggleKeydown, { passive: false });

    // Visibility API für Performance mit shared utility
    this.visibilityCleanup = onVisibilityChange((isVisible) => {
      if (!isVisible) {
        this.handleVisibilityChange();
      }
    });

    // Theme-System Events
    if (window.themeSystem?.addEventListener) {
      this.eventManager.add(window.themeSystem, 'themeChanged', this.boundThemeChanged);
    }
  }

  /**
   * Toggle-Click Handler mit magischen Übergangseffekten
   */
  async handleToggleClick(event) {
    try {
      event.preventDefault();
      
      if (this.isTransitioning) return;
      this.isTransitioning = true;

      // Erstelle Übergangseffekt
      await this.createTransitionEffect(event);

      // Toggle Theme über das globale System
      window.themeSystem?.toggleTheme?.();

      // Haptic-Feedback
      this.simulateHapticFeedback();

      // Transition beenden
      setTimeout(() => {
        this.isTransitioning = false;
      }, 1000);

    } catch (error) {
      log.error('Theme-Toggle fehlgeschlagen:', error);
      this.isTransitioning = false;
    }
  }

  /**
   * Keyboard Handler für Accessibility
   */
  handleToggleKeydown(event) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      // Simuliere Koordinaten für konsistente Effekte
      const rect = this.artwork.getBoundingClientRect();
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
   * Erstelle magischen Übergangseffekt
   */
  async createTransitionEffect(event) {
    if (!this.skyCanvas) return;

    // Ripple-Effekt vom Klickpunkt
    const rect = this.artwork.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;

    // Erstelle temporären Ripple
    const ripple = document.createElement('div');
    ripple.style.cssText = `
      position: absolute;
      top: ${y}%;
      left: ${x}%;
      width: 4px;
      height: 4px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(255,255,255,0.8), transparent);
      transform: translate(-50%, -50%) scale(0);
      animation: artworkRipple 0.8s ease-out forwards;
      pointer-events: none;
      z-index: 100;
    `;

    this.skyCanvas.appendChild(ripple);

    // CSS für Ripple-Animation einfügen falls nicht vorhanden
    // Ensure external CSS for ripple is loaded
    const RIPPLE_CSS_HREF = '/content/webentwicklung/footer/day-night-artwork.css';
    if (!document.querySelector(`link[href="${RIPPLE_CSS_HREF}"]`)) {
      const link = document.createElement('link');
      link.setAttribute('rel', 'stylesheet');
      link.setAttribute('href', RIPPLE_CSS_HREF);
      document.head.appendChild(link);
    }

    // Cleanup nach Animation
    setTimeout(() => {
      if (ripple.parentNode) {
        ripple.remove();
      }
    }, 800);
  }

  /**
   * Starte natürliche Animationen
   */
  startNaturalAnimations() {
    // Bereits über CSS definiert, hier könnten zusätzliche 
    // programmatische Animationen hinzugefügt werden
  }

  /**
   * Haptic-Feedback-Simulation
   */
  simulateHapticFeedback() {
    this.artwork.style.transform = 'scale(0.95)';
    setTimeout(() => {
      this.artwork.style.transform = '';
    }, 150);
  }

  /**
   * Synchronisiert mit aktuellem Theme
   */
  syncWithCurrentTheme() {
    if (!window.themeSystem) return;

    const currentTheme = window.themeSystem.getCurrentTheme();
    
    // Theme-Attribute setzen für CSS-Selektoren
    document.documentElement.setAttribute('data-theme', currentTheme);
  }

  /**
   * Theme-Changed Event Handler
   */
  onThemeChanged(event) {
    const newTheme = event?.detail?.theme;
    if (newTheme) {
      
      // CSS data-theme Attribut aktualisieren
      document.documentElement.setAttribute('data-theme', newTheme);
    }
  }

  /**
   * Visibility-Change Handler für Performance
   */
  onVisibilityChange() {
    if (!this.artwork) return;
    
    const isHidden = document.hidden;
    const artworkWrapper = this.artwork.closest('.day-night-artwork-wrapper');
    
    if (artworkWrapper) {
      const animations = artworkWrapper.querySelectorAll('[style*="animation"]');
      animations.forEach(el => {
        el.style.animationPlayState = isHidden ? 'paused' : 'running';
      });
    }
  }

  /**
   * Cleanup-Methode mit EventManager
   */
  destroy() {
    // Event Manager cleanup (alle Listener automatisch)
    this.eventManager.destroy();
    
    // Visibility cleanup
    if (this.visibilityCleanup) {
      this.visibilityCleanup();
      this.visibilityCleanup = null;
    }

    // Referenzen löschen
    this.artwork = null;
    this.skyCanvas = null;

    this.isInitialized = false;
  }
}

// Globale Instanz erstellen und exportieren
const dayNightArtworkState = {
  manager: null
};

/**
 * Initialisiert das Day/Night Artwork
 */
export async function initializeDayNightArtwork() {
  if (dayNightArtworkState.manager) {
    return dayNightArtworkState.manager;
  }

  dayNightArtworkState.manager = new DayNightArtworkManager();
  const success = await dayNightArtworkState.manager.initialize();
  
  if (!success) {
    dayNightArtworkState.manager = null;
    throw new Error('Fehler beim Initialisieren des Day/Night Artwork');
  }

  return dayNightArtworkState.manager;
}

/**
 * Globale API für Day/Night Artwork
 */
window.dayNightArtwork = {
  initialize: initializeDayNightArtwork,
  getInstance: () => dayNightArtworkState.manager
};

export default dayNightArtworkState;
