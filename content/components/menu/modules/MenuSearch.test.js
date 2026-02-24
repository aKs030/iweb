import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';

// Setup Globals
global.window = {
  matchMedia: () => ({ matches: false, addEventListener: () => {} }),
  dispatchEvent: mock.fn(),
  location: { href: '', pathname: '/', hash: '' },
  localStorage: { getItem: () => null, setItem: () => {} },
  innerWidth: 1024,
};
global.document = {
  documentElement: {
    setAttribute: () => {},
    removeAttribute: () => {},
    lang: 'en',
  },
  querySelector: mock.fn(() => null),
  createElement: (tag) => ({
    tagName: tag.toUpperCase(),
    classList: {
      add: mock.fn(),
      remove: mock.fn(),
      toggle: mock.fn(),
      contains: () => false,
    },
    setAttribute: mock.fn(),
    removeAttribute: mock.fn(),
    appendChild: mock.fn(),
    style: { setProperty: () => {} },
    addEventListener: mock.fn(),
    removeEventListener: mock.fn(),
    focus: mock.fn(),
    select: mock.fn(),
    contains: () => false,
    closest: () => null,
  }),
  body: { classList: { add: () => {} } },
  addEventListener: mock.fn(),
  removeEventListener: mock.fn(),
};

// Handle navigator
if (!global.navigator) {
  global.navigator = { language: 'en-US' };
} else {
  Object.defineProperty(global, 'navigator', {
    value: { language: 'en-US' },
    writable: true,
    configurable: true,
  });
}

global.requestAnimationFrame = (fn) => setTimeout(fn, 0);
global.cancelAnimationFrame = (id) => clearTimeout(id);
global.fetch = mock.fn(async () => ({ ok: true, json: async () => ({}) }));
global.AbortController = class {
  abort() {}
  signal = {};
};
global.HTMLElement = class {};
global.Element = class {};
global.EventTarget = class {
  addEventListener() {}
  removeEventListener() {}
  dispatchEvent() {}
};

// Import after globals setup
const { MenuSearch } = await import('./MenuSearch.js');

describe('MenuSearch', () => {
  let container;
  let state;
  let search;

  beforeEach(() => {
    // Mock container and elements
    const createMockElement = (className) => ({
      classList: {
        add: mock.fn(),
        remove: mock.fn(),
        toggle: mock.fn(),
        contains: (c) => className.includes(c),
      },
      setAttribute: mock.fn(),
      removeAttribute: mock.fn(),
      getAttribute: mock.fn(),
      querySelector: mock.fn(),
      querySelectorAll: mock.fn(() => []),
      addEventListener: mock.fn(),
      removeEventListener: mock.fn(),
      closest: mock.fn(),
      focus: mock.fn(),
      select: mock.fn(),
      style: { setProperty: () => {} },
      value: '',
      contains: () => false,
      id: 'mock-id',
    });

    container = createMockElement('site-menu');
    container.querySelector = mock.fn((selector) => {
      if (selector === '.search-trigger')
        return createMockElement('search-trigger');
      if (selector === '.menu-search') return createMockElement('menu-search');
      if (selector === '.menu-search__bar')
        return createMockElement('menu-search__bar');
      if (selector === '.menu-search__input')
        return createMockElement('menu-search__input');
      if (selector === '.menu-search__results')
        return createMockElement('menu-search__results');
      if (selector === '.menu-search__clear')
        return createMockElement('menu-search__clear');
      if (selector === '.site-menu__toggle')
        return createMockElement('site-menu__toggle');
      return null;
    });

    // Header mock for 'search-mode' class
    container.closest = mock.fn((sel) => {
      if (sel === '.site-header') return createMockElement('site-header');
      return null;
    });

    state = {
      setOpen: mock.fn(),
      isOpen: false,
    };

    search = new MenuSearch(container, state, {
      SEARCH_DEBOUNCE: 10, // Short debounce for testing
      SEARCH_MIN_QUERY_LENGTH: 1,
    });
  });

  it('should initialize correctly', () => {
    search.init();
    assert.strictEqual(search.isOpen, false);
    assert.ok(search.trigger);
    assert.ok(search.input);
  });

  it('should open search mode', async () => {
    search.init();
    search.openSearchMode();

    assert.strictEqual(search.isOpen, true);
    assert.strictEqual(state.setOpen.mock.calls.length, 1);
    assert.deepStrictEqual(state.setOpen.mock.calls[0].arguments, [false]); // Closes menu
  });

  it('should close search mode', () => {
    search.init();
    search.openSearchMode();
    assert.strictEqual(search.isOpen, true);

    search.closeSearchMode();
    assert.strictEqual(search.isOpen, false);
  });

  it('should schedule search on input', (t, done) => {
    search.init();
    search.openSearchMode();

    // Spy on executeSearch
    search.executeSearch = mock.fn();

    // Simulate input
    search.input.value = 'test';
    search.scheduleSearch('test');

    setTimeout(() => {
      assert.strictEqual(search.executeSearch.mock.calls.length, 1);
      assert.deepStrictEqual(search.executeSearch.mock.calls[0].arguments, [
        'test',
      ]);
      done();
    }, 20);
  });
});
