/**
 * Modern Event System
 * @version 3.1.0
 */

import { createLogger } from './logger.js';
import { i18n } from './i18n.js';

const log = createLogger('Events');

/** Event names (frozen for immutability) */
export const EVENTS = Object.freeze({
  DOM_READY: 'app:domReady',
  CORE_INITIALIZED: 'app:coreInitialized',
  MODULES_READY: 'app:modulesReady',
  LOADING_UNBLOCKED: 'app:loadingUnblocked',
  LOADING_HIDE: 'app:loaderHide',
  HERO_INIT_READY: 'app:heroInitReady',
  HERO_LOADED: 'hero:loaded',
  HERO_TYPING_END: 'hero:typingEnd',
  FOOTER_LOADED: 'footer:loaded',
  FOOTER_EXPANDED: 'footer:expanded',
  FOOTER_COLLAPSED: 'footer:collapsed',
});

/**
 * Fire native custom event on document
 */
export function fire(type, detail = null, target = document) {
  try {
    target?.dispatchEvent?.(new CustomEvent(type, { detail, bubbles: true }));
  } catch (error) {
    log.error(`Failed to dispatch event: ${type}`, error);
  }
}

/**
 * Global Event Handlers for retry & share actions
 */
export const GlobalEventHandlers = {
  init(announcer) {
    document.addEventListener('click', async (event) => {
      // Retry handling
      if (event.target?.closest('.retry-btn')) {
        event.preventDefault();
        try {
          globalThis.location.reload();
        } catch {}
        return;
      }

      // Share handling
      const share = event.target?.closest('.btn-share');
      if (share) {
        event.preventDefault();
        const shareUrl =
          share.dataset.shareUrl || 'https://www.youtube.com/@aks.030';

        if (navigator.share) {
          try {
            await navigator.share({
              title: document.title,
              text: i18n.t('common.share_text'),
              url: shareUrl,
            });
          } catch {}
        } else if (navigator.clipboard) {
          try {
            await navigator.clipboard.writeText(shareUrl);
            announcer?.(i18n.t('common.link_copied'), { dedupe: true });
          } catch {}
        } else {
          try {
            globalThis.prompt(i18n.t('common.copy_link'), shareUrl);
          } catch {}
        }
      }
    });
  },
};
