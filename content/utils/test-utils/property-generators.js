/**
 * Property-Based Testing Generators
 * Arbitrary generators for use with fast-check
 * 
 * @module property-generators
 * @version 1.0.0
 */

import fc from 'fast-check';
import { EVENTS } from '../shared-utilities.js';

/**
 * Arbitrary generators for property-based testing
 */
export const arbitraries = {
  // Logger test generators
  logLevel: () => fc.constantFrom('error', 'warn', 'info', 'debug'),
  
  logMessage: () => fc.string({ minLength: 1, maxLength: 100 }),
  
  logCategory: () => fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9_-]*$/),
  
  // Timer test generators
  delay: () => fc.integer({ min: 0, max: 1000 }),
  
  shortDelay: () => fc.integer({ min: 0, max: 100 }),
  
  // Cookie test generators
  cookieName: () => fc.stringMatching(/^[a-zA-Z0-9_-]+$/),
  
  cookieValue: () => fc.string({ minLength: 0, maxLength: 100 }).filter(s => !s.includes('=') && !s.includes(';')),
  
  cookieDays: () => fc.integer({ min: 1, max: 365 }),
  
  // Array test generators
  numberArray: () => fc.array(fc.integer(), { minLength: 0, maxLength: 100 }),
  
  stringArray: () => fc.array(fc.string(), { minLength: 0, maxLength: 50 }),
  
  // Event test generators
  eventType: () => {
    const eventValues = Object.values(EVENTS);
    return fc.constantFrom(...eventValues);
  },
  
  eventDetail: () => fc.oneof(
    fc.constant(null),
    fc.constant(undefined),
    fc.object(),
    fc.string(),
    fc.integer(),
  ),
  
  // Section test generators
  sectionId: () => fc.stringMatching(/^[a-z][a-z0-9-]*$/),
  
  // DOM element generators
  elementId: () => fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9_-]*$/),
  
  // URL generators
  urlPath: () => fc.stringMatching(/^\/[a-z0-9/-]*$/),
  
  // Throttle/Debounce generators
  throttleLimit: () => fc.integer({ min: 10, max: 500 }),
  
  debounceWait: () => fc.integer({ min: 10, max: 500 }),
  
  // Function call count generators
  callCount: () => fc.integer({ min: 1, max: 20 }),
  
  // Intersection observer generators
  intersectionRatio: () => fc.double({ min: 0, max: 1 }),
  
  rootMargin: () => fc.constantFrom(
    '0px',
    '10px',
    '50px',
    '100px',
    '-10px',
    '10px 20px',
    '10px 20px 30px 40px',
  ),
  
  threshold: () => fc.oneof(
    fc.double({ min: 0, max: 1 }),
    fc.array(fc.double({ min: 0, max: 1 }), { minLength: 1, maxLength: 5 }),
  ),
  
  // Search query generators
  searchQuery: () => fc.string({ minLength: 0, maxLength: 50 }),
  
  // Menu state generators
  menuState: () => fc.constantFrom('open', 'closed'),
  
  // Random integer range generators
  integerRange: () => fc.tuple(
    fc.integer({ min: -100, max: 100 }),
    fc.integer({ min: -100, max: 100 }),
  ).map(([a, b]) => [Math.min(a, b), Math.max(a, b)]),
};

/**
 * Helper to create a mock DOM element for testing
 */
export function createMockElement(id = 'test-element') {
  if (typeof document === 'undefined') {
    return {
      id,
      classList: {
        add: () => {},
        remove: () => {},
        contains: () => false,
      },
      getAttribute: () => null,
      setAttribute: () => {},
      dispatchEvent: () => true,
    };
  }
  
  const element = document.createElement('div');
  element.id = id;
  return element;
}

/**
 * Helper to create a mock IntersectionObserver entry
 */
export function createMockIntersectionEntry(target, isIntersecting = true, intersectionRatio = 1) {
  return {
    target,
    isIntersecting,
    intersectionRatio,
    boundingClientRect: target.getBoundingClientRect?.() || {},
    intersectionRect: {},
    rootBounds: {},
    time: Date.now(),
  };
}

/**
 * Helper to wait for a condition to be true
 */
export async function waitFor(condition, timeout = 1000, interval = 10) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  
  throw new Error(`Timeout waiting for condition after ${timeout}ms`);
}

/**
 * Helper to count function calls
 */
export function createCallCounter() {
  let count = 0;
  const fn = () => { count++; };
  fn.getCount = () => count;
  fn.reset = () => { count = 0; };
  return fn;
}

export default arbitraries;
