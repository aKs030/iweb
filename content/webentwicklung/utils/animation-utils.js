// Zentrale Animation Engine Utilities
import { createLogger } from './logger.js';

const log = createLogger('AnimationUtils');

/**
 * Triggert einen Re-scan der Enhanced Animation Engine
 * Gemeinsamer Helper für alle Module, die Animationen nutzen
 */
export function triggerAnimationScan() {
  if (window.enhancedAnimationEngine?.scan) {
    window.enhancedAnimationEngine.scan();
  }
}

/**
 * Triggert Animationen für alle Elemente in einem Container
 * @param {HTMLElement} container - Container mit animierbaren Elementen
 * @param {Object} options - Animation-Optionen
 */
export function animateElementsIn(container, options = { force: true }) {
  if (!container) return;
  
  if (window.enhancedAnimationEngine?.animateElementsIn) {
    window.enhancedAnimationEngine.animateElementsIn(container, options);
  }
  
  log.debug('Container-Elemente animiert', { container: container?.tagName, options });
}