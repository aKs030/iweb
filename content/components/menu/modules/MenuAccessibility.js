/**
 * Menu Accessibility - WCAG 2.1 AA compliance
 */
import { a11y } from '#core/accessibility-manager.js';

/**
 * @typedef {typeof import('./MenuConfig.js').MenuConfig} MenuComponentConfig
 */
/**
 * @typedef {Partial<MenuComponentConfig>} MenuComponentConfigInput
 */

export class MenuAccessibility {
  /**
   * @param {HTMLElement|ShadowRoot} container
   * @param {import('./MenuState.js').MenuState} state
   * @param {MenuComponentConfigInput} [config]
   */
  constructor(container, state, config = {}) {
    this.container = container;
    this.state = state;
    this.config = config;
    this._cleanupFns = [];
  }

  init() {
    this.setupAnnouncements();
  }

  setupAnnouncements() {
    const mobileBreakpoint =
      this.config.MOBILE_BREAKPOINT ?? this.config.TABLET_BREAKPOINT ?? 900;
    let hasSyncedInitialState = false;

    this._cleanupFns.push(
      this.state.signals.open.subscribe((isOpen) => {
        if (!hasSyncedInitialState) {
          hasSyncedInitialState = true;
          return;
        }

        if (window.innerWidth <= mobileBreakpoint) {
          this.announce(
            isOpen ? 'Hauptmenü geöffnet' : 'Hauptmenü geschlossen',
          );
        }
      }),
    );
  }

  announce(message) {
    a11y?.announce(message, { priority: 'polite' });
  }

  destroy() {
    this._cleanupFns.forEach((fn) => fn());
    this._cleanupFns = [];
  }
}
