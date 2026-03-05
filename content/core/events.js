/**
 * Modern Event System
 * @version 3.2.0
 */

import { createLogger } from './logger.js';
import { i18n } from './i18n.js';

const log = createLogger('Events');

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
  _initialized: false,
  init(announcer) {
    if (this._initialized) return;
    this._initialized = true;
    document.addEventListener('click', async (event) => {
      // Retry handling
      if (event.target?.closest('.retry-btn')) {
        event.preventDefault();
        try {
          globalThis.location.reload();
        } catch (err) {
          log.debug('Reload failed:', err);
        }
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
          } catch (err) {
            // AbortError = user cancelled share dialog — not a real error
            if (err?.name !== 'AbortError') {
              log.debug('Share failed:', err);
            }
          }
        } else if (navigator.clipboard) {
          try {
            await navigator.clipboard.writeText(shareUrl);
            announcer?.(i18n.t('common.link_copied'), { dedupe: true });
          } catch (err) {
            log.debug('Clipboard write failed:', err);
          }
        } else {
          try {
            globalThis.prompt(i18n.t('common.copy_link'), shareUrl);
          } catch (err) {
            log.debug('Prompt failed:', err);
          }
        }
      }
    });
  },
};
