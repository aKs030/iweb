/**
 * Menu Analytics Integration
 * Track menu interactions for analytics
 */

export class MenuAnalytics {
  constructor(state, config = {}) {
    this.state = state;
    this.config = config;
    this.enabled = config.ENABLE_ANALYTICS || false;
  }

  init() {
    if (!this.enabled) return;

    this.state.on('openChange', (isOpen) => {
      this.trackEvent('menu_interaction', {
        action: isOpen ? 'open' : 'close',
        timestamp: Date.now(),
      });
    });

    this.state.on('titleChange', ({ title, subtitle }) => {
      this.trackEvent('menu_title_change', {
        title,
        subtitle,
        timestamp: Date.now(),
      });
    });

    this.state.on('activeLinkChange', (link) => {
      this.trackEvent('menu_navigation', {
        link,
        timestamp: Date.now(),
      });
    });
  }

  trackEvent(eventName, data) {
    // Google Analytics 4
    if (window.gtag) {
      window.gtag('event', eventName, data);
    }

    // Matomo
    if (window._paq) {
      window._paq.push(['trackEvent', 'Menu', eventName, JSON.stringify(data)]);
    }

    // Custom analytics
    if (window.analytics?.track) {
      window.analytics.track(eventName, data);
    }

    // Debug log
    if (this.config.ENABLE_DEBUG) {
      console.log('[Menu Analytics]', eventName, data);
    }
  }

  trackTiming(category, variable, time) {
    if (window.gtag) {
      window.gtag('event', 'timing_complete', {
        name: variable,
        value: time,
        event_category: category,
      });
    }
  }

  destroy() {
    // Cleanup if needed
  }
}
