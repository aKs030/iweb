/**
 * Style Activator
 * @version 1.0.0
 */

import { createLogger, onDOMReady } from './shared-utilities.js';

const log = createLogger('StyleActivator');

export class StyleActivator {
  activateDeferredStyles() {
    try {
      const links = document.querySelectorAll(
        'link[rel="stylesheet"][data-defer="1"]',
      );
      links.forEach((link) => {
        try {
          link.media = 'all';
          delete link.dataset.defer;
        } catch {
          /* ignore */
        }
      });
    } catch {
      /* ignore */
    }
  }

  observeHeadForDeferredLinks() {
    try {
      const headObserver = new MutationObserver((mutations) => {
        for (const m of mutations) {
          for (const node of m.addedNodes) {
            try {
              if (
                node.nodeType === 1 &&
                node.matches?.('link[rel="stylesheet"][data-defer="1"]')
              ) {
                node.media = 'all';
                delete node.dataset.defer;
              }
            } catch {
              /* ignore */
            }
          }
        }
      });

      headObserver.observe(document.head || document.documentElement, {
        childList: true,
        subtree: true,
      });

      globalThis.addEventListener('load', () => headObserver.disconnect(), {
        once: true,
      });
    } catch {
      /* ignore */
    }
  }

  init() {
    this.activateDeferredStyles();
    onDOMReady(() => this.activateDeferredStyles());
    globalThis.addEventListener('load', () => this.activateDeferredStyles());
    this.observeHeadForDeferredLinks();

    log.debug('Style activator initialized');
  }
}
