import { createLogger } from './logger.js';
import { isLocalDevHost } from './runtime-env.js';

const log = createLogger('SWLifecycle');

export function initServiceWorkerLifecycle(options = {}) {
  const { isTest = false, announce = null } = options;

  if (typeof navigator === 'undefined' || isTest) return;
  if (!('serviceWorker' in navigator)) return;

  if (isLocalDevHost(globalThis.location.hostname)) {
    navigator.serviceWorker
      .getRegistrations()
      .then((registrations) =>
        registrations.forEach((item) => item.unregister()),
      )
      .catch((error) => {
        log.debug('Service worker unregister failed in local dev', error);
      });
    return;
  }

  globalThis.addEventListener(
    'load',
    () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (!newWorker) return;

            newWorker.addEventListener('statechange', () => {
              if (
                newWorker.state === 'installed' &&
                navigator.serviceWorker.controller
              ) {
                log.info('New Service Worker available');
                announce?.(
                  'Update verfügbar — Seite neu laden für die neueste Version',
                );
              }
            });
          });
        })
        .catch((error) => {
          log.warn('Service worker registration failed', error);
        });
    },
    { once: true },
  );
}

export function initNetworkStatusIndicator(options = {}) {
  const { announce = null, timers = null } = options;

  if (typeof document === 'undefined') return () => {};
  if (document.getElementById('network-status-indicator')) return () => {};

  const indicator = document.createElement('div');
  indicator.id = 'network-status-indicator';
  indicator.className = 'network-status-indicator';
  indicator.setAttribute('role', 'status');
  indicator.setAttribute('aria-live', 'polite');
  indicator.setAttribute('aria-atomic', 'true');
  document.body.appendChild(indicator);

  let hasInitialized = false;
  let dismissTimer = null;

  const clearDismissTimer = () => {
    if (!dismissTimer) return;

    if (timers?.clearTimeout) {
      timers.clearTimeout(dismissTimer);
    } else {
      clearTimeout(dismissTimer);
    }

    dismissTimer = null;
  };

  const updateIndicator = () => {
    const isOffline = navigator.onLine === false;

    clearDismissTimer();

    if (isOffline) {
      indicator.classList.add('is-visible', 'is-offline');
      indicator.classList.remove('is-online');
      indicator.textContent =
        'Offline-Modus: Navigation und lokale Suchtreffer verfuegbar, AI-Antworten eingeschraenkt.';
      announce?.('Offline-Modus aktiv');
      hasInitialized = true;
      return;
    }

    if (!hasInitialized) {
      hasInitialized = true;
      indicator.classList.remove('is-visible', 'is-online', 'is-offline');
      return;
    }

    indicator.classList.add('is-visible', 'is-online');
    indicator.classList.remove('is-offline');
    indicator.textContent = 'Verbindung wiederhergestellt.';
    announce?.('Online-Verbindung wiederhergestellt');

    const dismiss = () => {
      indicator.classList.remove('is-visible', 'is-online');
      dismissTimer = null;
    };

    dismissTimer = timers?.setTimeout
      ? timers.setTimeout(dismiss, 3500)
      : setTimeout(dismiss, 3500);
  };

  window.addEventListener('online', updateIndicator);
  window.addEventListener('offline', updateIndicator);
  updateIndicator();

  return () => {
    clearDismissTimer();
    window.removeEventListener('online', updateIndicator);
    window.removeEventListener('offline', updateIndicator);
    indicator.remove();
  };
}
