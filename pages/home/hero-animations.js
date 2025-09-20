import { createLogger } from '../../content/webentwicklung/utils/logger.js';

/**
 * Hero-spezifische Animation Engine Erweiterungen
 * Erweitert die Enhanced Animation Engine mit Hero/Home-spezifischen Funktionen
 * @author Abdulkerim Sesli
 * @version 1.0
 */

const log = createLogger('hero-animations');

/**
 * Hero-spezifische Animation-Aliases
 * Diese Aliases waren ursprünglich in der enhanced-animation-engine.js
 */
export const HERO_ANIMATION_ALIASES = new Map([
  // Hero-spezifische Grußtext-Animation
  ['greeting', 'fadeInUp'],
  // Weitere Hero-spezifische Animationen können hier hinzugefügt werden
]);

/**
 * Erweitert die globale Animation Engine um Hero-spezifische Aliases
 * @param {Object} animationEngine - Die Enhanced Animation Engine Instanz
 */
export function extendAnimationEngineForHero(animationEngine) {
  if (!animationEngine || typeof animationEngine.parseDataAttribute !== 'function') {
    log.warn('Animation Engine nicht verfügbar oder inkompatibel');
    return;
  }

  // Backup der ursprünglichen parseDataAttribute Methode
  const originalParseDataAttribute = animationEngine.parseDataAttribute.bind(animationEngine);
  
  // Erweiterte parseDataAttribute Methode mit Hero-Aliases
  animationEngine.parseDataAttribute = function(element, attribute) {
    const result = originalParseDataAttribute(element, attribute);
    
    if (!result) return null;
    
    // Hero-spezifische Alias-Behandlung
    const heroAlias = HERO_ANIMATION_ALIASES.get(result.type?.toLowerCase());
    if (heroAlias) {
      result.type = heroAlias;
    }
    
    return result;
  };
}

/**
 * Hero-spezifische Animation-Konfiguration
 */
export const HERO_ANIMATION_CONFIG = {
  // Optimierte Performance-Einstellungen für Hero-Bereich
  threshold: 0.1,
  rootMargin: '50px',
  repeatOnScroll: true,
  
  // Hero-spezifische Animation-Durationen
  durations: {
    greeting: 0.8,      // Längere Dauer für Grußtext
    heroButtons: 0.6,   // Standard für Hero-Buttons
    heroSubtitle: 0.7   // Subtitle-Animationen
  }
};

/**
 * Initialisiert Hero-spezifische Animationen
 * Sollte nach dem Laden der main Animation Engine aufgerufen werden
 */
export function initHeroAnimations() {
  // Warten bis die globale Animation Engine verfügbar ist
  const waitForEngine = () => {
    if (window.enhancedAnimationEngine) {
      extendAnimationEngineForHero(window.enhancedAnimationEngine);
      
      // Hero-spezifische Konfiguration anwenden
      window.enhancedAnimationEngine.setRepeatOnScroll?.(HERO_ANIMATION_CONFIG.repeatOnScroll);
      
      // Initial scan für Hero-Elemente
      window.enhancedAnimationEngine.scan?.();
      
      log.debug('Hero-spezifische Animationen initialisiert');
    } else {
      // Retry nach kurzer Verzögerung
      setTimeout(waitForEngine, 100);
    }
  };
  
  waitForEngine();
}

/**
 * Helper: Animiert Hero-Grußtext mit spezifischen Einstellungen
 * @param {HTMLElement} greetingElement - Das Grußtext-Element
 */
export function animateGreeting(greetingElement) {
  if (!greetingElement) return;
  
  // Setze Hero-spezifische Attribute für Grußtext-Animation
  if (!greetingElement.hasAttribute('data-animation')) {
    greetingElement.setAttribute('data-animation', 'greeting');
    greetingElement.setAttribute('data-duration', HERO_ANIMATION_CONFIG.durations.greeting);
    greetingElement.setAttribute('data-delay', '200');
  }
  
  // Trigger Animation über globale Engine
  if (window.enhancedAnimationEngine) {
    window.enhancedAnimationEngine.scan?.();
  }
}

/**
 * Helper: Animiert Hero-Buttons mit spezifischen Einstellungen
 * @param {HTMLElement} containerElement - Container mit Hero-Buttons
 */
export function animateHeroButtons(containerElement) {
  if (!containerElement) return;
  
  const buttons = containerElement.querySelectorAll('.hero-buttons [data-animation]');
  buttons.forEach((button, index) => {
    // Gestaffelte Animation für mehrere Buttons
    const delay = 300 + (index * 150);
    button.setAttribute('data-delay', delay.toString());
    
    if (!button.hasAttribute('data-duration')) {
      button.setAttribute('data-duration', HERO_ANIMATION_CONFIG.durations.heroButtons);
    }
  });
  
  // Trigger Animation über globale Engine
  if (window.enhancedAnimationEngine) {
    window.enhancedAnimationEngine.animateElementsIn?.(containerElement, { force: true });
  }
}