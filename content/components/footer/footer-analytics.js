import { applyCspNonce } from '#core/csp-nonce.js';
import { createLogger } from '#core/logger.js';

const log = createLogger('AnalyticsManager');

/**
 * Analytics Manager
 */
export class AnalyticsManager {
  #loaded = false;

  load() {
    if (this.#loaded) return;

    document
      .querySelectorAll('script[data-consent="required"]')
      .forEach((script) => {
        const newScript = document.createElement('script');
        for (const attr of script.attributes) {
          const name = attr.name === 'data-src' ? 'src' : attr.name;
          if (!['data-consent', 'type'].includes(attr.name)) {
            newScript.setAttribute(name, attr.value);
          }
        }
        applyCspNonce(newScript);
        if (script.innerHTML.trim()) newScript.innerHTML = script.innerHTML;
        script.replaceWith(newScript);
      });

    this.#loaded = true;
    log.info('Analytics loaded');
  }

  /**
   * @param {boolean | { analytics?: boolean, ads?: boolean }} granted
   */
  updateConsent(granted) {
    const win = /** @type {import('#core/types.js').GlobalWindow} */ (window);

    if (typeof win.gtag !== 'function') return;

    const analyticsGranted =
      typeof granted === 'boolean' ? granted : Boolean(granted?.analytics);
    const adsGranted =
      typeof granted === 'boolean' ? granted : Boolean(granted?.ads);

    try {
      win.gtag('consent', 'update', {
        ad_storage: adsGranted ? 'granted' : 'denied',
        analytics_storage: analyticsGranted ? 'granted' : 'denied',
        ad_user_data: adsGranted ? 'granted' : 'denied',
        ad_personalization: adsGranted ? 'granted' : 'denied',
      });
    } catch (e) {
      log.error('Consent update failed', e);
    }
  }
}
