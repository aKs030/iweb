import { createLogger } from './logger.js';
import { upsertHeadLink, upsertMeta } from './dom-utils.js';
import { BASE_URL } from '../config/constants.js';

const log = createLogger('PWAManager');

export function setupPWAAssets(brandData) {
  try {
    upsertHeadLink({ rel: 'manifest', href: '/manifest.json' });

    upsertMeta('theme-color', '#0d0d0d');
    upsertMeta('mobile-web-app-capable', 'yes');
    upsertMeta('apple-mobile-web-app-capable', 'yes');
    upsertMeta('apple-mobile-web-app-title', brandData.name);
    upsertMeta('apple-mobile-web-app-status-bar-style', 'default');

    const iconSizes = [16, 32, 48, 64, 128, 192, 256, 512];
    iconSizes.forEach((size) => {
      upsertHeadLink({
        rel: 'icon',
        href: `${BASE_URL}/assets/img/icons/favicon-${size}.png`,
        attrs: { sizes: `${size}x${size}`, type: 'image/png' },
      });
    });

    upsertHeadLink({
      rel: 'apple-touch-icon',
      href: `${BASE_URL}/assets/img/icons/apple-touch-icon.png`,
      attrs: { sizes: '180x180' },
    });

    upsertHeadLink({
      rel: 'icon',
      href: `${BASE_URL}/assets/img/icons/favicon.svg`,
      attrs: { sizes: 'any', type: 'image/svg+xml' },
    });

    upsertHeadLink({
      rel: 'mask-icon',
      href: `${BASE_URL}/assets/img/icons/safari-pinned-tab.svg`,
      attrs: { color: '#0d0d0d' },
    });

    const shortcutIcon = document.head.querySelector(
      'link[rel="shortcut icon"]',
    );
    if (!shortcutIcon) {
      const link = document.createElement('link');
      link.rel = 'shortcut icon';
      link.href = `${BASE_URL}/assets/img/icons/favicon.ico`;
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
      href: `${baseUrl}/assets/img/icons/safari-pinned-tab.svg`,
      color: '#0d0d0d',
    },
  ];

  const iconLinks = [
    {
      rel: 'icon',
      sizes: '16x16',
      href: `${baseUrl}/assets/img/icons/favicon-16.png`,
      type: 'image/png',
    },
    {
      rel: 'icon',
      sizes: '32x32',
      href: `${baseUrl}/assets/img/icons/favicon-32.png`,
      type: 'image/png',
    },
    {
      rel: 'icon',
      sizes: '48x48',
      href: `${baseUrl}/assets/img/icons/favicon-48.png`,
      type: 'image/png',
    },
    {
      rel: 'icon',
      sizes: '64x64',
      href: `${baseUrl}/assets/img/icons/favicon-64.png`,
      type: 'image/png',
    },
    {
      rel: 'icon',
      sizes: '128x128',
      href: `${baseUrl}/assets/img/icons/favicon-128.png`,
      type: 'image/png',
    },
    {
      rel: 'icon',
      sizes: '192x192',
      href: `${baseUrl}/assets/img/icons/favicon-192.png`,
      type: 'image/png',
    },
    {
      rel: 'icon',
      sizes: '256x256',
      href: `${baseUrl}/assets/img/icons/favicon-256.png`,
      type: 'image/png',
    },
    {
      rel: 'icon',
      sizes: '512x512',
      href: `${baseUrl}/assets/img/icons/favicon-512.png`,
      type: 'image/png',
    },
    {
      rel: 'icon',
      sizes: 'any',
      href: `${baseUrl}/assets/img/icons/favicon.svg`,
      type: 'image/svg+xml',
    },
    {
      rel: 'shortcut icon',
      href: `${baseUrl}/assets/img/icons/favicon.ico`,
    },
    {
      rel: 'apple-touch-icon',
      sizes: '180x180',
      href: `${baseUrl}/assets/img/icons/apple-touch-icon.png`,
    },
  ];

  const metas = [
    { name: 'theme-color', content: '#0d0d0d' },
    { name: 'mobile-web-app-capable', content: 'yes' },
    { name: 'apple-mobile-web-app-capable', content: 'yes' },
    { name: 'apple-mobile-web-app-title', content: brandData.name },
    { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
  ];

  return { links, iconLinks, metas };
}
