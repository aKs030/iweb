/**
 * Event Utilities
 * Provides helper functions for adding event listeners with proper passive handling
 * @module event-utils
 */

/**
 * Add event listener with automatic passive mode for scroll-blocking events
 * @param {EventTarget} target - The element to attach the listener to
 * @param {string} eventType - The event type (e.g., 'touchstart', 'touchmove', 'wheel')
 * @param {EventListener} handler - The event handler function
 * @param {AddEventListenerOptions} [options={}] - Additional options
 * @returns {Function} Cleanup function to remove the listener
 */
export function addPassiveListener(target, eventType, handler, options = {}) {
  // Events that should default to passive for better scroll performance
  const passiveEvents = [
    'touchstart',
    'touchmove',
    'touchend',
    'touchcancel',
    'wheel',
    'mousewheel',
  ];

  const shouldBePassive = passiveEvents.includes(eventType);

  const finalOptions = {
    ...options,
    // Default to passive for scroll-blocking events unless explicitly set to false
    passive: options.passive !== false && shouldBePassive,
  };

  target.addEventListener(eventType, handler, finalOptions);

  // Return cleanup function
  return () => target.removeEventListener(eventType, handler, finalOptions);
}

/**
 * Add multiple event listeners with passive mode
 * @param {EventTarget} target - The element to attach listeners to
 * @param {string[]} eventTypes - Array of event types
 * @param {EventListener} handler - The event handler function
 * @param {AddEventListenerOptions} [options={}] - Additional options
 * @returns {Function} Cleanup function to remove all listeners
 */
export function addPassiveListeners(target, eventTypes, handler, options = {}) {
  const cleanupFunctions = eventTypes.map((eventType) =>
    addPassiveListener(target, eventType, handler, options),
  );

  // Return cleanup function that removes all listeners
  return () => cleanupFunctions.forEach((cleanup) => cleanup());
}

/**
 * Check if passive event listeners are supported
 * @deprecated All modern browsers support passive listeners. This check is no longer needed.
 * @returns {boolean}
 */
export function supportsPassive() {
  return true;
}
