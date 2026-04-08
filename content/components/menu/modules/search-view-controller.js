import { i18n } from '#core/i18n.js';
import { withViewTransition } from '#core/view-transitions.js';
import {
  VIEW_TRANSITION_ROOT_CLASSES,
  VIEW_TRANSITION_TYPES,
  VIEW_TRANSITION_TIMINGS_MS,
} from '#core/view-transition-constants.js';
import { isConnectedHTMLElement, resolveMenuHost } from './menu-dom-helpers.js';

const SEARCH_VIEW_TRANSITION_OPTIONS = Object.freeze({
  rootClasses: [VIEW_TRANSITION_ROOT_CLASSES.MENU],
  timeoutMs: VIEW_TRANSITION_TIMINGS_MS.SEARCH_TIMEOUT,
  preserveLiveBackdropOnMobile: true,
});

export class MenuSearchViewController {
  /**
   * @param {HTMLElement|ShadowRoot} container
   * @param {HTMLElement|null} host
   */
  constructor(container, host = null) {
    this.container = container;
    this.host = resolveMenuHost(container, host);

    this.isOpen = false;
    this.trigger = null;
    this.panel = null;
    this.bar = null;
    this.input = null;
    this.results = null;
    this.clearBtn = null;
  }

  bindElementsFromContainer() {
    const trigger = this.container.querySelector('.search-trigger');
    const panel = this.container.querySelector('.menu-search');
    const bar = this.container.querySelector('.menu-search__bar');
    const input = /** @type {HTMLInputElement|null} */ (
      this.container.querySelector('.menu-search__input')
    );
    const results = this.container.querySelector('.menu-search__results');
    const clearBtn = this.container.querySelector('.menu-search__clear');

    if (!trigger || !panel || !bar || !input || !results) {
      return false;
    }

    this.trigger = trigger;
    this.panel = panel;
    this.bar = bar;
    this.input = input;
    this.results = results;
    this.clearBtn = clearBtn;
    return true;
  }

  getHeaderElement() {
    const header = this.host?.closest?.('.site-header');
    return isConnectedHTMLElement(header) ? header : null;
  }

  getToggleElement() {
    const toggle = this.container.querySelector('.site-menu__toggle');
    return isConnectedHTMLElement(toggle) ? toggle : null;
  }

  getPrimaryFocusTarget() {
    return this.input || this.trigger || this.getToggleElement();
  }

  getRestoreFocusTarget() {
    return this.trigger || this.getToggleElement();
  }

  getFocusTrapRoots() {
    return [this.panel, this.trigger, this.getToggleElement()].filter(
      isConnectedHTMLElement,
    );
  }

  syncSearchTriggerState(isOpen) {
    const trigger = this.trigger;
    if (!trigger) return;

    if (isOpen) {
      const closeLabel = i18n.tOrFallback(
        'menu.search_close',
        'Suche schließen',
      );
      trigger.setAttribute('aria-label', closeLabel);
      trigger.setAttribute('title', closeLabel);
      trigger.setAttribute('aria-expanded', 'true');
      return;
    }

    trigger.setAttribute(
      'aria-label',
      i18n.tOrFallback('menu.search_label', 'Suche'),
    );
    trigger.setAttribute(
      'title',
      i18n.tOrFallback('menu.search_tooltip', 'Website durchsuchen'),
    );
    trigger.setAttribute('aria-expanded', 'false');
  }

  syncToggleSearchState(isOpen) {
    const toggle = this.getToggleElement();
    if (!toggle) return;

    toggle.classList.toggle('active', isOpen);
    if (isOpen) {
      toggle.setAttribute(
        'aria-label',
        i18n.tOrFallback('menu.search_close', 'Suche schließen'),
      );
      return;
    }

    toggle.setAttribute('aria-label', i18n.tOrFallback('menu.toggle', 'Menü'));
  }

  applySearchOpenState() {
    const header = this.getHeaderElement();
    const panel = this.panel;
    const input = this.input;

    if (!header || !panel || !input) return;
    if (this.isOpen) return;

    this.isOpen = true;
    void withViewTransition(
      () => {
        header.classList.add('search-mode');
        panel.setAttribute('aria-hidden', 'false');
        this.syncSearchTriggerState(true);
        this.syncToggleSearchState(true);
        this.setSearchPopupExpanded(false);

        requestAnimationFrame(() => {
          try {
            input.focus({ preventScroll: true });
          } catch {
            input.focus();
          }
          input.select();
        });
      },
      {
        ...SEARCH_VIEW_TRANSITION_OPTIONS,
        types: [VIEW_TRANSITION_TYPES.SEARCH_OPEN],
      },
    );
  }

  applySearchClosedState({ keyboardController, searchStore, renderer }) {
    const wasOpen = this.isOpen;
    const header = this.getHeaderElement();
    this.isOpen = false;
    keyboardController.clear();

    const applyClosedState = () => {
      if (header) {
        header.classList.remove('search-mode');
      }

      if (this.panel) {
        this.panel.setAttribute('aria-hidden', 'true');
      }

      this.syncSearchTriggerState(false);
      this.syncToggleSearchState(false);

      if (this.input) {
        this.input.value = '';
      }

      searchStore.clear({ query: '' });
      renderer.renderState(this.results, { hidden: true });
    };

    if (!wasOpen) {
      applyClosedState();
      return;
    }

    void withViewTransition(applyClosedState, {
      ...SEARCH_VIEW_TRANSITION_OPTIONS,
      types: [VIEW_TRANSITION_TYPES.SEARCH_CLOSE],
    });
  }

  updateClearButtonVisibility(query) {
    if (!this.clearBtn) return;
    this.clearBtn.classList.toggle('visible', Boolean(query && query.trim()));
  }

  setSearchPopupExpanded(isExpanded) {
    const expanded = String(Boolean(isExpanded));

    if (this.bar) {
      this.bar.setAttribute('aria-expanded', expanded);
    }

    if (this.input) {
      this.input.setAttribute('aria-expanded', expanded);
      if (!isExpanded) {
        this.input.removeAttribute('aria-activedescendant');
      }
    }
  }

  buildSearchOptionId(index) {
    const resultsId = this.results?.id || 'menu-search-results';
    return `${resultsId}-option-${index}`;
  }
}
