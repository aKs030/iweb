/**
 * Vitest Setup File
 * Runs before all tests
 */

import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Global test utilities
globalThis.testUtils = {
  // Add custom test utilities here
};

// Mock console methods in tests to reduce noise
globalThis.console = {
  ...console,
  // Keep error and warn for debugging
  error: console.error,
  warn: console.warn,
  // Suppress log, info, debug in tests
  log: () => {},
  info: () => {},
  debug: () => {},
};

// Mock window.matchMedia (used by many components)
// Note: addListener/removeListener are deprecated and removed
// Use addEventListener/removeEventListener instead
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

// Mock IntersectionObserver
globalThis.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  takeRecords() {
    return [];
  }
  unobserve() {}
};

// Mock ResizeObserver
globalThis.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
};

// Mock requestIdleCallback
globalThis.requestIdleCallback = (cb) => {
  return setTimeout(cb, 0);
};

globalThis.cancelIdleCallback = (id) => {
  clearTimeout(id);
};

// Mock localStorage
const localStorageMock = {
  getItem: (key) => localStorageMock[key] || null,
  setItem: (key, value) => {
    localStorageMock[key] = String(value);
  },
  removeItem: (key) => {
    delete localStorageMock[key];
  },
  clear: () => {
    Object.keys(localStorageMock).forEach((key) => {
      if (key !== 'getItem' && key !== 'setItem' && key !== 'removeItem' && key !== 'clear') {
        delete localStorageMock[key];
      }
    });
  },
};

globalThis.localStorage = localStorageMock;

// Mock fetch (basic implementation)
globalThis.fetch = async () => {
  return {
    ok: true,
    status: 200,
    json: async () => ({}),
    text: async () => '',
    headers: new Map(),
  };
};
