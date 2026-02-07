/**
 * Menu Accessibility - WCAG 2.1 AA compliance
 */

export class MenuAccessibility {
  constructor(container, state) {
    this.container = container;
    this.state = state;
  }

  init() {
    this.setupARIA();
    this.setupKeyboardNav();
    this.setupFocusManagement();
  }

  setupARIA() {
    const menu = this.container.querySelector('.site-menu');
    const toggle = this.container.querySelector('.site-menu__toggle');

    if (menu) {
      menu.setAttribute('role', 'navigation');
      menu.setAttribute('aria-hidden', 'true');
    }

    if (toggle) {
      toggle.setAttribute('aria-controls', menu?.id || 'navigation');
      toggle.setAttribute('aria-expanded', 'false');
    }

    // Update ARIA on state changes
    this.state.on('openChange', (isOpen) => {
      if (toggle) toggle.setAttribute('aria-expanded', String(isOpen));
      if (menu) menu.setAttribute('aria-hidden', String(!isOpen));
    });
  }

  setupKeyboardNav() {
    const menu = this.container.querySelector('.site-menu');
    if (!menu) return;

    const focusableElements = menu.querySelectorAll(
      'a[href], button:not([disabled])',
    );

    this._keydownHandlers = [];

    focusableElements.forEach((el, index) => {
      const handler = (e) => {
        if (e.key === 'Tab') {
          // Trap focus within menu when open
          if (this.state.isOpen) {
            if (e.shiftKey && index === 0) {
              e.preventDefault();
              focusableElements[focusableElements.length - 1].focus();
            } else if (!e.shiftKey && index === focusableElements.length - 1) {
              e.preventDefault();
              focusableElements[0].focus();
            }
          }
        }
      };
      el.addEventListener('keydown', handler);
      this._keydownHandlers.push({ el, handler });
    });
  }

  setupFocusManagement() {
    // Announce menu state changes to screen readers
    this.state.on('openChange', (isOpen) => {
      this.announce(isOpen ? 'Menü geöffnet' : 'Menü geschlossen');
    });

    this.state.on('titleChange', ({ title }) => {
      // Update document title for screen readers
      if (document.title !== title) {
        document.title = title;
      }
    });
  }

  announce(message) {
    let liveRegion = document.getElementById('menu-live-region');

    if (!liveRegion) {
      liveRegion = document.createElement('div');
      liveRegion.id = 'menu-live-region';
      liveRegion.setAttribute('role', 'status');
      liveRegion.setAttribute('aria-live', 'polite');
      liveRegion.setAttribute('aria-atomic', 'true');
      liveRegion.style.cssText =
        'position:absolute;left:-10000px;width:1px;height:1px;overflow:hidden;';
      document.body.appendChild(liveRegion);
    }

    liveRegion.textContent = message;
    setTimeout(() => (liveRegion.textContent = ''), 1000);
  }

  destroy() {
    // Remove keyboard event listeners
    if (this._keydownHandlers) {
      this._keydownHandlers.forEach(({ el, handler }) => {
        el.removeEventListener('keydown', handler);
      });
      this._keydownHandlers = null;
    }
    const liveRegion = document.getElementById('menu-live-region');
    if (liveRegion) liveRegion.remove();
  }
}
