/**
 * Menu Accessibility - WCAG 2.1 AA compliance
 */

export class MenuAccessibility {
  constructor(container, state, config = {}) {
    this.container = container;
    this.state = state;
    this.config = config;
    this._cleanupFns = [];
  }

  init() {
    this.setupFocusTrap();
    this.setupAnnouncements();
  }

  setupFocusTrap() {
    const mobileBreakpoint =
      this.config.MOBILE_BREAKPOINT ?? this.config.TABLET_BREAKPOINT ?? 900;

    const handleKeydown = (e) => {
      if (e.key !== 'Tab') return;

      // Only trap focus if menu is open AND we are in mobile view
      if (!this.state.isOpen || window.innerWidth > mobileBreakpoint) return;

      const menu = this.container.querySelector('.site-menu');
      const toggle = this.container.querySelector('.site-menu__toggle');

      if (!menu || !toggle) return;

      // Get all focusable elements inside the navigation list
      const menuItems = Array.from(
        menu.querySelectorAll('a[href], button:not([disabled])'),
      );

      // In our DOM structure, the Menu (<nav>) comes before the Toggle (<button>)
      // So the natural tab order is: [Menu Item 1, ... Menu Item N, Toggle]
      const focusables = [...menuItems, toggle];

      if (focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (e.shiftKey) {
        // Shift + Tab (Backward)
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        // Tab (Forward)
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    this.container.addEventListener('keydown', handleKeydown);
    this._cleanupFns.push(() =>
      this.container.removeEventListener('keydown', handleKeydown),
    );
  }

  setupAnnouncements() {
    const mobileBreakpoint =
      this.config.MOBILE_BREAKPOINT ?? this.config.TABLET_BREAKPOINT ?? 900;
    this.state.on('openChange', (isOpen) => {
      if (window.innerWidth <= mobileBreakpoint) {
        this.announce(isOpen ? 'Hauptmenü geöffnet' : 'Hauptmenü geschlossen');
      }
    });
  }

  announce(message) {
    let liveRegion = document.getElementById('a11y-live-region');

    if (!liveRegion) {
      liveRegion = document.createElement('div');
      liveRegion.id = 'a11y-live-region';
      liveRegion.setAttribute('role', 'status');
      liveRegion.setAttribute('aria-live', 'polite');
      liveRegion.className = 'sr-only';
      liveRegion.style.cssText =
        'position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;';
      document.body.appendChild(liveRegion);
    }

    liveRegion.textContent = '';
    setTimeout(() => {
      liveRegion.textContent = message;
    }, this.config.ANNOUNCEMENT_DELAY ?? 100);
  }

  destroy() {
    this._cleanupFns.forEach((fn) => fn());
    this._cleanupFns = [];

    const liveRegion = document.getElementById('a11y-live-region');
    if (liveRegion) liveRegion.remove();
  }
}
