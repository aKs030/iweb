/**
 * Modern Analytics Wrapper
 * @version 1.0.0
 */

import { createLogger } from './logger.js';

const log = createLogger('Analytics');

/**
 * Analytics event queue
 */
const eventQueue = [];
let isInitialized = false;

/**
 * Initialize analytics
 */
export function initAnalytics() {
  if (isInitialized) return;

  // Ensure dataLayer exists
  window.dataLayer = window.dataLayer || [];

  // Process queued events
  eventQueue.forEach((event) => sendEvent(event));
  eventQueue.length = 0;

  isInitialized = true;
  log.info('Analytics initialized');
}

/**
 * Send analytics event
 * @param {Object} event - Event data
 */
export function sendEvent(event) {
  if (!isInitialized) {
    eventQueue.push(event);
    return;
  }

  try {
    window.dataLayer.push(event);
    log.debug('Event sent:', event);
  } catch (error) {
    log.warn('Failed to send event:', error);
  }
}

/**
 * Track page view
 * @param {Object} [data] - Additional page data
 */
export function trackPageView(data = {}) {
  sendEvent({
    event: 'page_view',
    page_path: window.location.pathname,
    page_title: document.title,
    page_location: window.location.href,
    ...data,
  });
}

/**
 * Track custom event
 * @param {string} eventName - Event name
 * @param {Object} [params] - Event parameters
 */
export function trackEvent(eventName, params = {}) {
  sendEvent({
    event: eventName,
    ...params,
  });
}

/**
 * Track user interaction
 * @param {string} action - Interaction action
 * @param {string} category - Interaction category
 * @param {string} [label] - Interaction label
 * @param {number} [value] - Interaction value
 */
export function trackInteraction(action, category, label, value) {
  sendEvent({
    event: 'interaction',
    interaction_action: action,
    interaction_category: category,
    interaction_label: label,
    interaction_value: value,
  });
}

/**
 * Track error
 * @param {Error} error - Error object
 * @param {Object} [context] - Error context
 */
export function trackError(error, context = {}) {
  sendEvent({
    event: 'error',
    error_message: error.message,
    error_stack: error.stack,
    error_name: error.name,
    ...context,
  });
}

/**
 * Track performance metric
 * @param {string} metric - Metric name
 * @param {number} value - Metric value
 * @param {Object} [data] - Additional data
 */
export function trackPerformance(metric, value, data = {}) {
  sendEvent({
    event: 'performance',
    metric_name: metric,
    metric_value: value,
    ...data,
  });
}

/**
 * Track conversion
 * @param {string} conversionId - Conversion ID
 * @param {Object} [data] - Conversion data
 */
export function trackConversion(conversionId, data = {}) {
  sendEvent({
    event: 'conversion',
    conversion_id: conversionId,
    ...data,
  });
}

/**
 * Set user properties
 * @param {Object} properties - User properties
 */
export function setUserProperties(properties) {
  sendEvent({
    event: 'set_user_properties',
    user_properties: properties,
  });
}

/**
 * Track scroll depth
 * @param {number} depth - Scroll depth percentage
 */
export function trackScrollDepth(depth) {
  sendEvent({
    event: 'scroll_depth',
    scroll_depth: depth,
  });
}

/**
 * Setup scroll tracking
 * @param {number[]} [thresholds] - Scroll thresholds
 */
export function setupScrollTracking(thresholds = [25, 50, 75, 90, 100]) {
  const tracked = new Set();

  const checkScroll = () => {
    const scrollPercent =
      (window.scrollY /
        (document.documentElement.scrollHeight - window.innerHeight)) *
      100;

    thresholds.forEach((threshold) => {
      if (scrollPercent >= threshold && !tracked.has(threshold)) {
        tracked.add(threshold);
        trackScrollDepth(threshold);
      }
    });
  };

  window.addEventListener('scroll', checkScroll, { passive: true });
  return () => window.removeEventListener('scroll', checkScroll);
}

/**
 * Track outbound link
 * @param {string} url - Link URL
 * @param {string} [text] - Link text
 */
export function trackOutboundLink(url, text) {
  sendEvent({
    event: 'outbound_link',
    link_url: url,
    link_text: text,
  });
}

/**
 * Setup outbound link tracking
 */
export function setupOutboundLinkTracking() {
  document.addEventListener('click', (event) => {
    const link = event.target.closest('a');
    if (!link) return;

    const href = link.href;
    if (!href || href.startsWith(window.location.origin)) return;

    trackOutboundLink(href, link.textContent);
  });
}

/**
 * Track file download
 * @param {string} url - File URL
 * @param {string} [fileName] - File name
 */
export function trackDownload(url, fileName) {
  sendEvent({
    event: 'file_download',
    file_url: url,
    file_name: fileName,
  });
}

/**
 * Setup download tracking
 * @param {string[]} [extensions] - File extensions to track
 */
export function setupDownloadTracking(
  extensions = ['pdf', 'zip', 'doc', 'docx', 'xls', 'xlsx'],
) {
  document.addEventListener('click', (event) => {
    const link = event.target.closest('a');
    if (!link) return;

    const href = link.href;
    if (!href) return;

    const ext = href.split('.').pop().toLowerCase();
    if (extensions.includes(ext)) {
      const fileName = href.split('/').pop();
      trackDownload(href, fileName);
    }
  });
}

// Auto-initialize on load
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    initAnalytics();
    trackPageView();
  });
}

export { isInitialized };
