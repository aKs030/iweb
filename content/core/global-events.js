/**
 * Global Event Handlers
 * Centralized delegation for common UI actions like sharing and retrying.
 * @module GlobalEvents
 */

import { createLogger } from './logger.js';

const log = createLogger('GlobalEvents');

export const GlobalEventHandlers = {
  handleRetry(event) {
    const retry = event.target?.closest('.retry-btn');
    if (!retry) return;

    event.preventDefault();
    try {
      globalThis.location.reload();
    } catch {
      /* fallback */
    }
  },

  async handleShare(event, announcer) {
    const share = event.target?.closest('.btn-share');
    if (!share) return;

    event.preventDefault();
    const shareUrl =
      share.dataset.shareUrl || 'https://www.youtube.com/@aks.030';
    const shareData = {
      title: document.title,
      text: 'Schau dir diesen Kanal an',
      url: shareUrl,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        log.warn('share failed', err);
      }
    } else if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(shareUrl);
        if (announcer) announcer('Link kopiert', { dedupe: true });
      } catch (err) {
        log.warn('Copy failed', err);
      }
    } else {
      try {
        globalThis.prompt('Link kopieren', shareUrl);
      } catch (err) {
        log.warn('prompt failed', err);
      }
    }
  },

  init(announcer) {
    document.addEventListener('click', (event) => {
      this.handleRetry(event);
      this.handleShare(event, announcer);
    });
  },
};
