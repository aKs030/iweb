/**
 * Tests for Accessibility Manager
 * Tests focus traps, media queries, and announcements
 * 
 * @module accessibility-manager.test
 * @version 1.0.0
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';

describe('Accessibility Manager', () => {
  let AccessibilityManager;
  let manager;

  beforeEach(async () => {
    // Clean up DOM
    document.body.innerHTML = '';
    document.head.innerHTML = '';
    
    // Mock matchMedia
    window.matchMedia = vi.fn((query) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    }));

    // Import fresh instance
    const module = await import('./accessibility-manager.js?t=' + Date.now());
    AccessibilityManager = module.a11y.constructor;
  });

  afterEach(() => {
    if (manager && manager.destroy) {
      manager.destroy();
    }
    document.body.innerHTML = '';
  });

  describe('Initialization', () => {
    test('should initialize with default values', () => {
      manager = new AccessibilityManager();
      
      expect(manager.focusTrapStack).toEqual([]);
      expect(manager.lastFocusedElement).toBeNull();
      expect(manager.reducedMotion).toBeDefined();
      expect(manager.highContrast).toBeDefined();
    });

    test('should be idempotent - multiple init calls should not cause issues', () => {
      manager = new AccessibilityManager();
      const firstInit = manager._initialized;
      
      manager.init();
      manager.init();
      
      expect(manager._initialized).toBe(firstInit);
    });

    test('should setup keyboard navigation', () => {
      manager = new AccessibilityManager();
      expect(manager._onKeyboardNav).toBeDefined();
    });
  });

  describe('Media Query Preferences', () => {
    test('should detect reduced motion preference', () => {
      window.matchMedia = vi.fn((query) => ({
        matches: query.includes('prefers-reduced-motion'),
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }));

      manager = new AccessibilityManager();
      expect(manager.reducedMotion).toBe(true);
    });

    test('should detect high contrast preference', () => {
      window.matchMedia = vi.fn((query) => ({
        matches: query.includes('prefers-contrast'),
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }));

      manager = new AccessibilityManager();
      expect(manager.highContrast).toBe(true);
    });
  });

  describe('Focus Trap', () => {
    test('should trap focus in container', () => {
      document.body.innerHTML = `
        <div id="modal">
          <button id="btn1">Button 1</button>
          <button id="btn2">Button 2</button>
        </div>
      `;

      manager = new AccessibilityManager();
      const container = document.getElementById('modal');
      manager.trapFocus(container);

      expect(manager.focusTrapStack.length).toBe(1);
      expect(manager.focusTrapStack[0].container).toBe(container);
    });

    test('should focus first focusable element', () => {
      document.body.innerHTML = `
        <div id="modal">
          <button id="btn1">Button 1</button>
          <button id="btn2">Button 2</button>
        </div>
      `;

      manager = new AccessibilityManager();
      const container = document.getElementById('modal');
      const btn1 = document.getElementById('btn1');
      
      manager.trapFocus(container);
      
      // Note: focus() in JSDOM doesn't actually change activeElement
      // We just verify the trap was set up
      expect(manager.focusTrapStack[0].firstFocusable).toBe(btn1);
    });

    test('should release focus trap', () => {
      document.body.innerHTML = `
        <button id="outside">Outside</button>
        <div id="modal">
          <button id="btn1">Button 1</button>
        </div>
      `;

      manager = new AccessibilityManager();
      const container = document.getElementById('modal');
      
      manager.trapFocus(container);
      expect(manager.focusTrapStack.length).toBe(1);
      
      manager.releaseFocus();
      expect(manager.focusTrapStack.length).toBe(0);
    });

    test('should handle container without focusable elements', () => {
      document.body.innerHTML = `
        <div id="modal">
          <p>No focusable elements</p>
        </div>
      `;

      manager = new AccessibilityManager();
      const container = document.getElementById('modal');
      
      manager.trapFocus(container);
      
      // Should not add trap if no focusable elements
      expect(manager.focusTrapStack.length).toBe(0);
    });

    test('should handle null container', () => {
      manager = new AccessibilityManager();
      
      expect(() => {
        manager.trapFocus(null);
      }).not.toThrow();
      
      expect(manager.focusTrapStack.length).toBe(0);
    });
  });

  describe('Keyboard Navigation', () => {
    test('should handle Tab key in focus trap', () => {
      document.body.innerHTML = `
        <div id="modal">
          <button id="btn1">Button 1</button>
          <button id="btn2">Button 2</button>
        </div>
      `;

      manager = new AccessibilityManager();
      const container = document.getElementById('modal');
      const btn2 = document.getElementById('btn2');
      
      manager.trapFocus(container);
      
      // Simulate Tab on last element
      const event = new KeyboardEvent('keydown', { key: 'Tab' });
      Object.defineProperty(event, 'preventDefault', {
        value: vi.fn(),
      });
      
      // Set active element to last focusable
      Object.defineProperty(document, 'activeElement', {
        value: btn2,
        writable: true,
        configurable: true,
      });
      
      manager.handleTabInTrap(event);
      
      // Should prevent default when at last element
      expect(event.preventDefault).toHaveBeenCalled();
    });

    test('should handle Shift+Tab in focus trap', () => {
      document.body.innerHTML = `
        <div id="modal">
          <button id="btn1">Button 1</button>
          <button id="btn2">Button 2</button>
        </div>
      `;

      manager = new AccessibilityManager();
      const container = document.getElementById('modal');
      const btn1 = document.getElementById('btn1');
      
      manager.trapFocus(container);
      
      // Simulate Shift+Tab on first element
      const event = new KeyboardEvent('keydown', { 
        key: 'Tab',
        shiftKey: true,
      });
      Object.defineProperty(event, 'preventDefault', {
        value: vi.fn(),
      });
      
      Object.defineProperty(document, 'activeElement', {
        value: btn1,
        writable: true,
        configurable: true,
      });
      
      manager.handleTabInTrap(event);
      
      expect(event.preventDefault).toHaveBeenCalled();
    });
  });

  describe('Animations', () => {
    test('should update animations for reduced motion', () => {
      manager = new AccessibilityManager();
      manager.reducedMotion = true;
      
      manager.updateAnimations();
      
      const style = document.documentElement.style;
      expect(style.getPropertyValue('--transition-fast')).toBe('0s');
      expect(style.getPropertyValue('--transition-base')).toBe('0s');
    });

    test('should not set animation properties when motion is not reduced', () => {
      manager = new AccessibilityManager();
      
      // First set reduced motion to add properties
      manager.reducedMotion = true;
      manager.updateAnimations();
      
      // Then disable reduced motion
      manager.reducedMotion = false;
      manager.updateAnimations();
      
      // Properties should still be '0s' because updateAnimations doesn't reset them
      // This is the actual behavior - it's a no-op when reducedMotion is false
      const style = document.documentElement.style;
      expect(style.getPropertyValue('--transition-fast')).toBe('0s');
    });
  });

  describe('Contrast', () => {
    test('should add high-contrast class when preference is set', () => {
      manager = new AccessibilityManager();
      manager.highContrast = true;
      
      manager.updateContrast();
      
      expect(document.body.classList.contains('high-contrast')).toBe(true);
    });

    test('should remove high-contrast class when preference is not set', () => {
      document.body.classList.add('high-contrast');
      
      manager = new AccessibilityManager();
      manager.highContrast = false;
      
      manager.updateContrast();
      
      expect(document.body.classList.contains('high-contrast')).toBe(false);
    });
  });

  describe('Announcements', () => {
    beforeEach(() => {
      // Create live regions
      document.body.innerHTML = `
        <div id="live-region-status" role="status" aria-live="polite"></div>
        <div id="live-region-assertive" role="alert" aria-live="assertive"></div>
      `;
    });

    test('should announce polite message', async () => {
      manager = new AccessibilityManager();
      const region = document.getElementById('live-region-status');
      
      manager.announce('Test message');
      
      // Wait for setTimeout
      await new Promise(resolve => setTimeout(resolve, 150));
      
      expect(region.textContent).toBe('Test message');
    });

    test('should announce assertive message', async () => {
      manager = new AccessibilityManager();
      const region = document.getElementById('live-region-assertive');
      
      manager.announce('Urgent message', { priority: 'assertive' });
      
      await new Promise(resolve => setTimeout(resolve, 150));
      
      expect(region.textContent).toBe('Urgent message');
    });

    test('should clear previous message when clearPrevious is true', async () => {
      manager = new AccessibilityManager();
      const region = document.getElementById('live-region-status');
      region.textContent = 'Old message';
      
      manager.announce('New message', { clearPrevious: true });
      
      // Should clear immediately
      expect(region.textContent).toBe('');
      
      await new Promise(resolve => setTimeout(resolve, 150));
      expect(region.textContent).toBe('New message');
    });

    test('should not announce empty message', () => {
      manager = new AccessibilityManager();
      const region = document.getElementById('live-region-status');
      
      manager.announce('');
      manager.announce(null);
      manager.announce(undefined);
      
      expect(region.textContent).toBe('');
    });

    test('should use global announce if available', () => {
      const mockAnnounce = vi.fn();
      window.announce = mockAnnounce;
      
      manager = new AccessibilityManager();
      manager.announce('Test', { priority: 'assertive' });
      
      expect(mockAnnounce).toHaveBeenCalledWith('Test', { assertive: true });
      
      delete window.announce;
    });
  });

  describe('Skip Links', () => {
    test('should setup skip links', () => {
      document.body.innerHTML = `
        <a href="#main" class="skip-link">Skip to main</a>
        <main id="main">Content</main>
      `;

      manager = new AccessibilityManager();
      
      expect(manager._skipRemovers).toBeDefined();
      expect(manager._skipRemovers.length).toBeGreaterThan(0);
    });

    test('should handle skip link click', () => {
      document.body.innerHTML = `
        <a href="#main" class="skip-link">Skip to main</a>
        <main id="main">Content</main>
      `;

      manager = new AccessibilityManager();
      const skipLink = document.querySelector('.skip-link');
      const main = document.getElementById('main');
      
      const event = new Event('click', { bubbles: true });
      Object.defineProperty(event, 'preventDefault', {
        value: vi.fn(),
      });
      
      skipLink.dispatchEvent(event);
      
      expect(event.preventDefault).toHaveBeenCalled();
      expect(main.getAttribute('tabindex')).toBe('-1');
    });
  });

  describe('Cleanup', () => {
    test('should cleanup event listeners on destroy', () => {
      manager = new AccessibilityManager();
      const removeEventListener = vi.spyOn(document, 'removeEventListener');
      
      manager.destroy();
      
      expect(removeEventListener).toHaveBeenCalled();
    });

    test('should cleanup media query listeners on destroy', () => {
      const mockRemoveEventListener = vi.fn();
      window.matchMedia = vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: mockRemoveEventListener,
      }));

      manager = new AccessibilityManager();
      manager.destroy();
      
      expect(mockRemoveEventListener).toHaveBeenCalled();
    });
  });
});
