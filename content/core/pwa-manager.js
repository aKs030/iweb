import { createLogger } from './logger.js';
import { upsertHeadLink, upsertMeta } from './utils.js';
import { BASE_URL } from '../config/constants.js';

const log = createLogger('PWAManager');

export function setupPWAAssets(brandData) {
  try {
    upsertHeadLink({ rel: 'manifest', href: '/manifest.json' });

    upsertMeta('theme-color', '#030303');
    upsertMeta('mobile-web-app-capable', 'yes');
    upsertMeta('apple-mobile-web-app-capable', 'yes');
    upsertMeta('apple-mobile-web-app-title', brandData.name);
    upsertMeta('apple-mobile-web-app-status-bar-style', 'black-translucent');

    // Optimierte Icon-Konfiguration für existierende Dateien
    upsertHeadLink({
      rel: 'icon',
      href: `${BASE_URL}/content/assets/img/icons/favicon.svg`,
      attrs: { sizes: 'any', type: 'image/svg+xml' },
    });

    upsertHeadLink({
      rel: 'icon',
      href: `${BASE_URL}/content/assets/img/icons/favicon-512.webp`,
      attrs: { sizes: '512x512', type: 'image/webp' },
    });

    upsertHeadLink({
      rel: 'apple-touch-icon',
      href: `${BASE_URL}/content/assets/img/icons/apple-touch-icon.webp`,
      attrs: { sizes: '180x180' },
    });

    upsertHeadLink({
      rel: 'mask-icon',
      href: `${BASE_URL}/content/assets/img/icons/safari-pinned-tab.svg`,
      attrs: { color: '#030303' },
    });

    const shortcutIcon = document.head.querySelector(
      'link[rel="shortcut icon"]',
    );
    if (!shortcutIcon) {
      const link = document.createElement('link');
      link.rel = 'shortcut icon';
      link.href = `${BASE_URL}/content/assets/img/icons/favicon.ico`;
      document.head.appendChild(link);
    }

    log.debug('PWA assets configured successfully');
  } catch (error) {
    log.error('Failed to setup PWA assets:', error);
  }
}

export function buildPwaAssets(baseUrl, brandData) {
  const links = [
    { rel: 'manifest', href: '/manifest.json' },
    {
      rel: 'mask-icon',
      href: `${baseUrl}/content/assets/img/icons/safari-pinned-tab.svg`,
      color: '#030303',
    },
  ];

  const iconLinks = [
    {
      rel: 'icon',
      sizes: 'any',
      href: `${baseUrl}/content/assets/img/icons/favicon.svg`,
      type: 'image/svg+xml',
    },
    {
      rel: 'icon',
      sizes: '512x512',
      href: `${baseUrl}/content/assets/img/icons/favicon-512.webp`,
      type: 'image/webp',
    },
    {
      rel: 'shortcut icon',
      href: `${baseUrl}/content/assets/img/icons/favicon.ico`,
    },
    {
      rel: 'apple-touch-icon',
      sizes: '180x180',
      href: `${baseUrl}/content/assets/img/icons/apple-touch-icon.webp`,
    },
  ];

  const metas = [
    { name: 'theme-color', content: '#030303' },
    { name: 'mobile-web-app-capable', content: 'yes' },
    { name: 'apple-mobile-web-app-capable', content: 'yes' },
    { name: 'apple-mobile-web-app-title', content: brandData.name },
    {
      name: 'apple-mobile-web-app-status-bar-style',
      content: 'black-translucent',
    },
  ];

  return { links, iconLinks, metas };
}
