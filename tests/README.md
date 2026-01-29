# Testing Guide

## Overview

This directory contains test files for the modernized components.

## Test Structure

```
tests/
└── README.md (this file - Testing guide)
```

**Note:** Test files have been removed as they were only placeholders without implementation.

## Running Tests

### Manual Testing

Test components manually in the browser:

1. **TypeWriter Component:**
   - Open any page with typewriter effect (e.g., homepage)
   - Verify text typing animation works

2. **Search Component:**
   - Press Cmd+K (Mac) or Ctrl+K (Windows)
   - Test search functionality
   - Test keyboard navigation

3. **Robot Companion:**
   - Check robot appears on page
   - Test chat functionality
   - Verify animations work

### Future: Automated Testing

To implement automated tests:

1. **Unit Tests** - Vitest or Jest
2. **Integration Tests** - Testing Library
3. **E2E Tests** - Playwright or Cypress

## Test Implementation Plan

### Phase 1: Unit Tests (Priority)

- [ ] TypeWriter class methods
- [ ] Search algorithm
- [ ] Timer management
- [ ] Type definitions

### Phase 2: Component Tests

- [ ] Web Component lifecycle
- [ ] Event dispatching
- [ ] Attribute changes
- [ ] Slot content

### Phase 3: Integration Tests

- [ ] Component interactions
- [ ] Event flow
- [ ] State management
- [ ] Memory leaks

### Phase 4: E2E Tests

- [ ] User workflows
- [ ] Keyboard shortcuts
- [ ] Responsive behavior
- [ ] Accessibility

## Test Framework Setup

### Option 1: Vitest (Recommended)

```bash
npm install -D vitest @vitest/ui
```

```javascript
// vitest.config.js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './tests/setup.js',
  },
});
```

### Option 2: Jest

```bash
npm install -D jest @testing-library/dom
```

```javascript
// jest.config.js
export default {
  testEnvironment: 'jsdom',
  transform: {},
  moduleNameMapper: {
    '^/content/(.*)$': '<rootDir>/content/$1',
  },
};
```

## Writing Tests

### Example: TypeWriter Test

```javascript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TypeWriter } from '../content/components/typewriter/TypeWriter.js';

describe('TypeWriter', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it('should initialize with valid config', () => {
    const textEl = document.createElement('div');
    const authorEl = document.createElement('div');
    container.appendChild(textEl);
    container.appendChild(authorEl);

    const typeWriter = new TypeWriter({
      textEl,
      authorEl,
      quotes: [{ text: 'Test', author: 'Tester' }],
    });

    expect(typeWriter).toBeDefined();
    expect(typeWriter.quotes).toHaveLength(1);
  });

  it('should cleanup on destroy', () => {
    const textEl = document.createElement('div');
    const authorEl = document.createElement('div');

    const typeWriter = new TypeWriter({
      textEl,
      authorEl,
      quotes: [{ text: 'Test' }],
    });

    typeWriter.destroy();

    expect(typeWriter.timerManager.timers.size).toBe(0);
    expect(typeWriter.timerManager.intervals.size).toBe(0);
  });
});
```

### Example: Web Component Test

```javascript
import { describe, it, expect } from 'vitest';
import '../content/components/typewriter/typewriter-web-component.js';

describe('TypeWriter Web Component', () => {
  it('should register custom element', () => {
    const el = document.createElement('type-writer');
    expect(el).toBeInstanceOf(HTMLElement);
    expect(customElements.get('type-writer')).toBeDefined();
  });

  it('should parse quotes attribute', () => {
    const el = document.createElement('type-writer');
    const quotes = [{ text: 'Test', author: 'Tester' }];
    el.setAttribute('quotes', JSON.stringify(quotes));

    document.body.appendChild(el);

    const typeWriter = el.getTypeWriter();
    expect(typeWriter.quotes).toEqual(quotes);

    el.remove();
  });
});
```

## Coverage Goals

- **Unit Tests:** 80%+ coverage
- **Integration Tests:** Critical paths
- **E2E Tests:** Main user workflows

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm test
      - run: npm run test:coverage
```

## Best Practices

1. **Test Isolation** - Each test should be independent
2. **Cleanup** - Always cleanup DOM and timers
3. **Mocking** - Mock external dependencies
4. **Assertions** - Clear and specific assertions
5. **Coverage** - Aim for high coverage but focus on critical paths

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library](https://testing-library.com/)
- [Playwright](https://playwright.dev/)
- [Web Components Testing](https://open-wc.org/docs/testing/testing-package/)
