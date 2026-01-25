/**
 * Vitest Setup File
 */

import { vi } from 'vitest';

// Mock window.location
global.window = {
  location: {
    hostname: 'localhost',
    pathname: '/',
    search: '',
    href: 'http://localhost/',
    origin: 'http://localhost',
  },
};

// Mock localStorage
global.localStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

// Mock fetch
global.fetch = vi.fn();

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock requestIdleCallback
global.requestIdleCallback = (cb) => setTimeout(cb, 0);
global.cancelIdleCallback = (id) => clearTimeout(id);
