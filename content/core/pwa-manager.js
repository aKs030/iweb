import { createLogger } from './logger.js';
import { upsertHeadLink, upsertMeta } from './utils.js';
import { BASE_URL } from '../config/constants.js';

const log = createLogger('PWAManager');

export function setupPWAAssets(brandData) {
  try {
    upsertHeadLink({ rel: 'manifest', href: '/manifest.json' });

    // Dynamic Theme Colors (Dark & Light) matching root.css
    const lightTheme = '#1e3a8a'; // Blue
    const darkTheme = '#030303'; // Dark

    // Ensure correct colors are enforced (updates existing or creates new)
    let metaDark = document.head.querySelector(
      'meta[name="theme-color"][media="(prefers-color-scheme: dark)"]',
    );
    if (!metaDark) {
      metaDark = document.createElement('meta');
      metaDark.name = 'theme-color';
      metaDark.media = '(prefers-color-scheme: dark)';
      document.head.appendChild(metaDark);
    }
    metaDark.content = darkTheme;

    let metaLight = document.head.querySelector(
      'meta[name="theme-color"][media="(prefers-color-scheme: light)"]',
    );
    if (!metaLight) {
      metaLight = document.createElement('meta');
      metaLight.name = 'theme-color';
      metaLight.media = '(prefers-color-scheme: light)';
      document.head.appendChild(metaLight);
    }
    metaLight.content = lightTheme;

    // Remove legacy single-color tag if it interferes (optional, but cleaner)
    const legacyMeta = document.head.querySelector(
      'meta[name="theme-color"]:not([media])',
    );
    if (legacyMeta) legacyMeta.remove();

    upsertMeta('mobile-web-app-capable', 'yes');
    upsertMeta('apple-mobile-web-app-capable', 'yes');
    upsertMeta('apple-mobile-web-app-title', brandData.name);
    upsertMeta('apple-mobile-web-app-status-bar-style', 'default');

    const iconSizes = [16, 32, 48, 64, 128, 192, 256, 512];
    iconSizes.forEach((size) => {
      upsertHeadLink({
        rel: 'icon',
        href: `${BASE_URL}/content/assets/img/icons/favicon-${size}.png`,
        attrs: { sizes: `${size}x${size}`, type: 'image/png' },
      });
    });

    upsertHeadLink({
      rel: 'apple-touch-icon',
      href: `${BASE_URL}/content/assets/img/icons/apple-touch-icon.png`,
      attrs: { sizes: '180x180' },
    });

    upsertHeadLink({
      rel: 'icon',
      href: `${BASE_URL}/content/assets/img/icons/favicon.svg`,
      attrs: { sizes: 'any', type: 'image/svg+xml' },
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
      color: '#1a1a2e',
    },
  ];

  const iconLinks = [
    {
      rel: 'icon',
      sizes: '16x16',
      href: `${baseUrl}/content/assets/img/icons/favicon-16.png`,
      type: 'image/png',
    },
    {
      rel: 'icon',
      sizes: '32x32',
      href: `${baseUrl}/content/assets/img/icons/favicon-32.png`,
      type: 'image/png',
    },
    {
      rel: 'icon',
      sizes: '48x48',
      href: `${baseUrl}/content/assets/img/icons/favicon-48.png`,
      type: 'image/png',
    },
    {
      rel: 'icon',
      sizes: '64x64',
      href: `${baseUrl}/content/assets/img/icons/favicon-64.png`,
      type: 'image/png',
    },
    {
      rel: 'icon',
      sizes: '128x128',
      href: `${baseUrl}/content/assets/img/icons/favicon-128.png`,
      type: 'image/png',
    },
    {
      rel: 'icon',
      sizes: '192x192',
      href: `${baseUrl}/content/assets/img/icons/favicon-192.png`,
      type: 'image/png',
    },
    {
      rel: 'icon',
      sizes: '256x256',
      href: `${baseUrl}/content/assets/img/icons/favicon-256.png`,
      type: 'image/png',
    },
    {
      rel: 'icon',
      sizes: '512x512',
      href: `${baseUrl}/content/assets/img/icons/favicon-512.png`,
      type: 'image/png',
    },
    {
      rel: 'icon',
      sizes: 'any',
      href: `${baseUrl}/content/assets/img/icons/favicon.svg`,
      type: 'image/svg+xml',
    },
    {
      rel: 'shortcut icon',
      href: `${baseUrl}/content/assets/img/icons/favicon.ico`,
    },
    {
      rel: 'apple-touch-icon',
      sizes: '180x180',
      href: `${baseUrl}/content/assets/img/icons/apple-touch-icon.png`,
    },
  ];

  const metas = [
    { name: 'theme-color', content: '#030303' }, // Default for static analysis tools
    { name: 'mobile-web-app-capable', content: 'yes' },
    { name: 'apple-mobile-web-app-capable', content: 'yes' },
    { name: 'apple-mobile-web-app-title', content: brandData.name },
    { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
  ];

  return { links, iconLinks, metas };
}
