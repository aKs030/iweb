import { createLogger } from './logger.js';
import { upsertHeadLink } from './utils.js';
import { iconUrl } from '../config/constants.js';

const log = createLogger('PWAManager');
const ROOT_FAVICON_ICO = '/favicon.ico';
const ROOT_FAVICON_SVG = '/favicon.svg';

export function setupPWAAssets(_brandData) {
  try {
    upsertHeadLink({ rel: 'manifest', href: '/manifest.json' });

    // Optimierte Icon-Konfiguration für existierende Dateien
    upsertHeadLink({
      rel: 'icon',
      href: ROOT_FAVICON_SVG,
      attrs: { sizes: 'any', type: 'image/svg+xml' },
    });

    upsertHeadLink({
      rel: 'icon',
      href: ROOT_FAVICON_ICO,
      attrs: { sizes: '48x48', type: 'image/x-icon' },
    });

    upsertHeadLink({
      rel: 'icon',
      href: iconUrl('favicon-512.webp'),
      attrs: { sizes: '512x512', type: 'image/webp' },
    });

    upsertHeadLink({
      rel: 'apple-touch-icon',
      href: iconUrl('apple-touch-icon.webp'),
      attrs: { sizes: '180x180' },
    });

    upsertHeadLink({
      rel: 'mask-icon',
      href: iconUrl('safari-pinned-tab.svg'),
      attrs: { color: '#030303' },
    });

    // Legacy 'shortcut icon' removed — 'rel="icon"' above covers all browsers.
    log.debug('PWA assets configured successfully');
  } catch (error) {
    log.error('Failed to setup PWA assets:', error);
  }
}
