import { createLogger } from './logger.js';

const log = createLogger('Analytics');

const eventQueue = [];
let isInitialized = false;

export function initAnalytics() {
  if (isInitialized) return;

  window.dataLayer = window.dataLayer || [];

  eventQueue.forEach((event) => sendEvent(event));
  eventQueue.length = 0;

  isInitialized = true;
  log.info('Analytics initialized');
}

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

export function trackPageView(data = {}) {
  sendEvent({
    event: 'page_view',
    page_path: window.location.pathname,
    page_title: document.title,
    page_location: window.location.href,
    ...data,
  });
}

export function trackEvent(eventName, params = {}) {
  sendEvent({
    event: eventName,
    ...params,
  });
}

export function trackInteraction(action, category, label, value) {
  sendEvent({
    event: 'interaction',
    interaction_action: action,
    interaction_category: category,
    interaction_label: label,
    interaction_value: value,
  });
}

export function trackError(error, context = {}) {
  sendEvent({
    event: 'error',
    error_message: error.message,
    error_stack: error.stack,
    error_name: error.name,
    ...context,
  });
}

export function trackPerformance(metric, value, data = {}) {
  sendEvent({
    event: 'performance',
    metric_name: metric,
    metric_value: value,
    ...data,
  });
}

export function trackConversion(conversionId, data = {}) {
  sendEvent({
    event: 'conversion',
    conversion_id: conversionId,
    ...data,
  });
}

export function setUserProperties(properties) {
  sendEvent({
    event: 'set_user_properties',
    user_properties: properties,
  });
}

export function trackScrollDepth(depth) {
  sendEvent({
    event: 'scroll_depth',
    scroll_depth: depth,
  });
}

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

export function trackOutboundLink(url, text) {
  sendEvent({
    event: 'outbound_link',
    link_url: url,
    link_text: text,
  });
}

export function setupOutboundLinkTracking() {
  document.addEventListener('click', (event) => {
    const link = event.target.closest('a');
    if (!link) return;

    const href = link.href;
    if (!href || href.startsWith(window.location.origin)) return;

    trackOutboundLink(href, link.textContent);
  });
}

export function trackDownload(url, fileName) {
  sendEvent({
    event: 'file_download',
    file_url: url,
    file_name: fileName,
  });
}

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

if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    initAnalytics();
    trackPageView();
  });
}

export { isInitialized };
