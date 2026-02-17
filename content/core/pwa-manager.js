import { createLogger } from './logger.js';
import { upsertHeadLink, upsertMeta } from './utils.js';
import { BASE_URL } from '../config/constants.js';

const log = createLogger('PWAManager');

function isTransparentColor(color) {
  if (!color) return true;
  const normalized = String(color).trim().toLowerCase();
  return (
    !normalized ||
    normalized === 'transparent' ||
    normalized === 'rgba(0, 0, 0, 0)' ||
    normalized === 'rgb(0 0 0 / 0)'
  );
}

function resolveThemeColor() {
  try {
    const bodyBg = document.body
      ? getComputedStyle(document.body).backgroundColor
      : '';
    if (!isTransparentColor(bodyBg)) return bodyBg;

    const htmlBg = getComputedStyle(document.documentElement).backgroundColor;
    if (!isTransparentColor(htmlBg)) return htmlBg;

    const rootStyle = getComputedStyle(document.documentElement);
    const rootBg = rootStyle.getPropertyValue('--bg-primary')?.trim();
    if (rootBg) return rootBg;
  } catch {
    /* ignore */
  }
  return '#1e3a8a';
}

function resolveAppleStatusBarStyle() {
  try {
    const existing = document.head
      .querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')
      ?.getAttribute('content')
      ?.trim();
    if (existing) return existing;
  } catch {
    /* ignore */
  }
  return 'default';
}

function upsertManagedThemeColor(color) {
  try {
    let meta = document.head.querySelector(
      'meta[name="theme-color"][data-managed-by="pwa-manager"]',
    );
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'theme-color');
      meta.setAttribute('data-managed-by', 'pwa-manager');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', color);
  } catch {
    /* ignore */
  }
}

export function setupPWAAssets(brandData) {
  try {
    upsertHeadLink({ rel: 'manifest', href: '/manifest.json' });

    upsertManagedThemeColor(resolveThemeColor());
    upsertMeta('mobile-web-app-capable', 'yes');
    upsertMeta('apple-mobile-web-app-capable', 'yes');
    upsertMeta('apple-mobile-web-app-title', brandData.name);
    upsertMeta(
      'apple-mobile-web-app-status-bar-style',
      resolveAppleStatusBarStyle(),
    );

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
