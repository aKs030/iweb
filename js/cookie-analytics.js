// cookie-analytics.js
export class CookieAnalytics {
  constructor(config) {
    this.config = config;
    this.gaId = config.googleAnalyticsId;
  }

  enableAnalytics() {
    if (!this.gaId) return;
    if (window.gtag) return;
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${this.gaId}`;
    document.head.appendChild(script);
    window.dataLayer = window.dataLayer || [];
    function gtag() {
      window.dataLayer.push(arguments);
    }
    window.gtag = gtag;
    gtag('js', new Date());
    gtag('config', this.gaId);
  }

  disableAnalytics() {
    // Opt-Out: Setze das Opt-Out Cookie
    document.cookie = `ga-disable-${this.gaId}=true; path=/; expires=Fri, 31 Dec 9999 23:59:59 GMT`;
    if (window.gtag) {
      window.gtag('config', this.gaId, { send_page_view: false });
    }
  }

  handleAction(action) {
    if (action === 'enable') {
      this.enableAnalytics();
    } else if (action === 'disable') {
      this.disableAnalytics();
    }
  }
}
