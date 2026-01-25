/**
 * Event Delegator Module
 * Handles delegated event listeners
 * @version 1.0.0
 */

import { createLogger, addListener } from './shared-utilities.js';

const log = createLogger('EventDelegator');

export class EventDelegator {
  constructor() {
    this.removeListeners = [];
  }

  handleRetryClick(event) {
    const target = event.target;
    const retry = target?.closest('.retry-btn');

    if (retry) {
      event.preventDefault();
      try {
        globalThis.location.reload();
      } catch {
        /* fallback */
      }
    }
  }

  handleShareClick(event, announce) {
    const target = event.target;
    const share = target?.closest('.btn-share');

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
      navigator.share(shareData).catch((err) => log.warn('share failed', err));
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl).then(() => {
        try {
          if (announce) {
            announce('Link kopiert', { dedupe: true });
          }
        } catch (err) {
          log.warn('announce failed', err);
        }
      });
    } else {
      try {
        globalThis.prompt('Link kopieren', shareUrl);
      } catch (err) {
        log.warn('prompt failed', err);
      }
    }
  }

  handleClick(event, announce) {
    this.handleRetryClick(event);
    this.handleShareClick(event, announce);
  }

  init(announce) {
    const removeClickListener = addListener(document, 'click', (event) =>
      this.handleClick(event, announce),
    );

    this.removeListeners.push(removeClickListener);
    log.debug('Event delegator initialized');
  }

  cleanup() {
    this.removeListeners.forEach((remove) => {
      try {
        remove();
      } catch {
        /* ignore */
      }
    });
    this.removeListeners = [];
    log.debug('Event delegator cleaned up');
  }
}
