/**
 * Offline Analytics Bridge
 *
 * Connects the main-thread analytics pipeline with IndexedDB + Background Sync.
 * When online, events are sent immediately via the existing analytics pathway.
 * When offline, events are queued in IndexedDB and a Background Sync is registered
 * so the Service Worker flushes them when connectivity returns.
 *
 * @module offline-analytics
 * @version 1.0.0
 */

import { createLogger } from './logger.js';
import { queueAnalyticsEvent, flushAnalyticsQueue } from './idb-store.js';

const log = createLogger('OfflineAnalytics');

// Background Sync tag — must match the one in sw.js
const SYNC_TAG = 'sync-analytics';

/**
 * Track an analytics event. If offline, the event is queued in IndexedDB
 * and a Background Sync is registered. If online, the event is sent
 * immediately (with IndexedDB as backup).
 *
 * @param {string} eventName — e.g. 'page_view', 'chat_message', 'click'
 * @param {Record<string, any>} [params={}] — Additional event parameters
 */
export async function trackEvent(eventName, params = {}) {
  try {
    // Always queue in IndexedDB first (durable)
    await queueAnalyticsEvent({ event: eventName, params });

    if (navigator.onLine) {
      // Online → attempt immediate flush
      const sent = await flushAnalyticsQueue();
      if (sent > 0) {
        log.debug(`Flushed ${sent} analytics event(s)`);
      }
    } else {
      // Offline → register Background Sync
      await registerBackgroundSync();
      log.debug(`Event "${eventName}" queued for Background Sync`);
    }
  } catch (err) {
    log.debug('Analytics tracking error:', err);
  }
}

/**
 * Register a Background Sync so the Service Worker flushes
 * analytics events when the device comes back online.
 */
async function registerBackgroundSync() {
  if (!('serviceWorker' in navigator)) return;

  try {
    const registration = await navigator.serviceWorker.ready;

    if ('sync' in registration) {
      await registration.sync.register(SYNC_TAG);
    }
  } catch {
    // Background Sync not supported — will flush on next online event
  }
}

/**
 * Initialize the offline analytics pipeline.
 * Flushes any events that were queued from a previous offline session
 * and listens for online/offline transitions.
 */
export function initOfflineAnalytics() {
  // Flush any events from previous sessions on startup
  if (navigator.onLine) {
    flushAnalyticsQueue().catch(() => {});
  }

  // Listen for connectivity changes
  window.addEventListener('online', () => {
    log.debug('Online — flushing analytics queue');
    flushAnalyticsQueue().catch(() => {});
  });

  // Register sync when going offline (pre-emptive)
  window.addEventListener('offline', () => {
    registerBackgroundSync().catch(() => {});
  });
}
