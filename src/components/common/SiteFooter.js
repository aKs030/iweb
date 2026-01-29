import { createLogger } from '/core/logger.js';
import { a11y } from '/core/accessibility-manager.js';
import footerHtml from '../footer/footer.html?raw';
import '../footer/footer.css';

const log = createLogger('site-footer');

// --- Helper Classes (Ported from FooterApp.js) ---

const CookieManager = {
  set(name, value, days = 365) {
    const date = new Date();
    date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
    const expires = `; expires=${date.toUTCString()}`;
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${name}=${value || ''}${expires}; path=/; SameSite=Lax${secure}`;
  },
  get(name) {
    const nameEQ = `${name}=`;
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
      cookie = cookie.trim();
      if (cookie.startsWith(nameEQ)) {
        return cookie.substring(nameEQ.length);
      }
    }
    return null;
  },
  delete(name) {
    const domains = [
      '',
      window.location.hostname,
      `.${window.location.hostname}`,
    ];
    domains.forEach((domain) => {
      const domainPart = domain ? `; domain=${domain}` : '';
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/${domainPart}`;
    });
  },
  deleteAnalytics() {
    const analyticsCookies = ['_ga', '_gid', '_gat', '_gat_gtag_G_S0587RQ4CN'];
    analyticsCookies.forEach((name) => this.delete(name));
  },
};

class DOM {
  constructor(root) {
    this.root = root;
    this.cache = new Map();
  }

  get(selector) {
    // If ID selector, try global first (legacy support) or scoped
    // But since logic expects elements inside footer, we search in root.
    if (selector.startsWith('#')) {
      const id = selector.slice(1);
      // Try finding inside component first
      let el = this.root.querySelector(selector);
      if (!el) el = document.getElementById(id); // Fallback
      return el;
    }
    const cached = this.cache.get(selector);
    if (cached?.isConnected) return cached;
    const el = this.root.querySelector(selector);
    if (el) this.cache.set(selector, el);
    return el;
  }

  getAll(selector) {
    return [...this.root.querySelectorAll(selector)];
  }

  clear() {
    this.cache.clear();
  }
}

class Analytics {
  constructor(root) {
      this.root = root;
  }

  load() {
    // Analytics scripts are likely global, but we check if they are inside the footer fragment
    // or global. The original code used document.querySelectorAll.
    // We should probably keep using document for analytics scripts as they go to head often or are global.
    document
      .querySelectorAll('script[data-consent="required"]')
      .forEach((script) => {
        const newScript = document.createElement('script');
        for (const attr of script.attributes) {
          const name = attr.name === 'data-src' ? 'src' : attr.name;
          if (!['data-consent', 'type'].includes(attr.name)) {
            newScript.setAttribute(name, attr.value);
          }
        }
        if (script.innerHTML.trim()) newScript.innerHTML = script.innerHTML;
        script.replaceWith(newScript);
      });
    log.info('Analytics loaded');
  }

  updateConsent(granted) {
    if (typeof gtag !== 'function') return;
    const status = granted ? 'granted' : 'denied';
    try {
      gtag('consent', 'update', {
        ad_storage: status,
        analytics_storage: status,
        ad_user_data: status,
        ad_personalization: status,
      });
    } catch (e) {
      log.error('Consent update failed', e);
    }
  }
}

class CookieBanner {
  constructor(dom, analytics) {
    this.dom = dom;
    this.analytics = analytics;
  }

  init() {
    const banner = this.dom.get('#cookie-banner');
    const acceptBtn = this.dom.get('#accept-cookies');
    const rejectBtn = this.dom.get('#reject-cookies');

    if (!banner || !acceptBtn) return;

    const consent = CookieManager.get('cookie_consent');
    const shouldShow = consent !== 'accepted' && consent !== 'rejected';

    banner.classList.toggle('hidden', !shouldShow);

    if (consent === 'accepted') {
      this.analytics.updateConsent(true);
      this.analytics.load();
    } else if (consent === 'rejected') {
      this.analytics.updateConsent(false);
    }

    acceptBtn.onclick = (e) => {
      e.stopPropagation();
      this.accept();
    };
    rejectBtn.onclick = (e) => {
      e.stopPropagation();
      this.reject();
    };
  }

  accept() {
    const banner = this.dom.get('#cookie-banner');
    if (banner) {
      banner.style.animation = 'cookieSlideOut 0.3s ease-out forwards';
      setTimeout(() => banner.classList.add('hidden'), 300);
    }
    CookieManager.set('cookie_consent', 'accepted');
    this.analytics.updateConsent(true);
    this.analytics.load();
    a11y?.announce('Cookies akzeptiert', { priority: 'polite' });
  }

  reject() {
    const banner = this.dom.get('#cookie-banner');
    if (banner) {
      banner.style.animation = 'cookieSlideOut 0.3s ease-out forwards';
      setTimeout(() => banner.classList.add('hidden'), 300);
    }
    CookieManager.set('cookie_consent', 'rejected');
    this.analytics.updateConsent(false);
    a11y?.announce('Cookies abgelehnt', { priority: 'polite' });
  }
}

class CookieSettings {
  constructor(dom, analytics) {
    this.dom = dom;
    this.analytics = analytics;
  }

  open() {
    const settings = this.dom.get('#cookie-settings');
    const content = this.dom.get('#footer-content');
    const footer = this.dom.get('#site-footer');
    const footerMin = this.dom.get('.footer-min');
    const footerMax = this.dom.get('.footer-max');

    if (!settings) return;

    const consent = CookieManager.get('cookie_consent');
    const analyticsToggle = this.dom.get('#analytics-toggle');
    const adsToggle = this.dom.get('#ads-toggle');

    if (analyticsToggle) analyticsToggle.checked = consent === 'accepted';
    if (adsToggle) adsToggle.checked = false;

    footer?.classList.add('expanded');
    document.body.classList.add('footer-expanded');
    footerMin?.classList.add('hidden');
    footerMax?.classList.remove('hidden');

    settings.classList.remove('hidden');
    content?.classList.add('hidden');

    this.bindEvents();
  }

  close() {
    const settings = this.dom.get('#cookie-settings');
    const content = this.dom.get('#footer-content');
    const footer = this.dom.get('#site-footer');
    const footerMin = this.dom.get('.footer-min');
    const footerMax = this.dom.get('.footer-max');

    settings?.classList.add('hidden');
    content?.classList.remove('hidden');

    footer?.classList.remove('expanded');
    document.body.classList.remove('footer-expanded');
    footerMin?.classList.remove('hidden');
    footerMax?.classList.add('hidden');
  }

  bindEvents() {
    const closeBtn = this.dom.get('#close-settings');
    const rejectAll = this.dom.get('#reject-all');
    const acceptSelected = this.dom.get('#accept-selected');
    const acceptAll = this.dom.get('#accept-all');

    if (closeBtn) closeBtn.onclick = () => this.close();

    if (rejectAll) rejectAll.onclick = () => {
      CookieManager.set('cookie_consent', 'rejected');
      CookieManager.deleteAnalytics();
      this.analytics.updateConsent(false);
      this.dom.get('#cookie-banner')?.classList.add('hidden');
      a11y?.announce('Nur notwendige Cookies', { priority: 'polite' });
      this.close();
    };

    if (acceptSelected) acceptSelected.onclick = () => {
      const analyticsEnabled = this.dom.get('#analytics-toggle')?.checked;
      CookieManager.set(
        'cookie_consent',
        analyticsEnabled ? 'accepted' : 'rejected',
      );

      if (analyticsEnabled) {
        this.analytics.updateConsent(true);
        this.analytics.load();
      } else {
        this.analytics.updateConsent(false);
        CookieManager.deleteAnalytics();
      }

      this.dom.get('#cookie-banner')?.classList.add('hidden');
      a11y?.announce('Einstellungen gespeichert', { priority: 'polite' });
      this.close();
    };

    if (acceptAll) acceptAll.onclick = () => {
      CookieManager.set('cookie_consent', 'accepted');
      this.analytics.updateConsent(true);
      this.analytics.load();
      this.dom.get('#cookie-banner')?.classList.add('hidden');
      a11y?.announce('Alle Cookies akzeptiert', { priority: 'polite' });
      this.close();
    };
  }
}

class FooterManager {
  constructor(dom) {
    this.dom = dom;
    this.expanded = false;
  }

  toggle() {
    const footer = this.dom.get('#site-footer');
    const min = this.dom.get('.footer-min');
    const max = this.dom.get('.footer-max');

    if (!footer) return;

    this.expanded = !this.expanded;

    if (this.expanded) {
      footer.classList.add('expanded');
      document.body.classList.add('footer-expanded');
      min?.classList.add('hidden');
      max?.classList.remove('hidden');
      min?.setAttribute('aria-expanded', 'true');
    } else {
      footer.classList.remove('expanded');
      document.body.classList.remove('footer-expanded');
      min?.classList.remove('hidden');
      max?.classList.add('hidden');
      min?.setAttribute('aria-expanded', 'false');
    }
  }

  close() {
    if (!this.expanded) return;
    this.toggle();
  }
}

class ScrollHandler {
  constructor(dom, footerManager) {
    this.dom = dom;
    this.footerManager = footerManager;
    this.observer = null;
  }

  init() {
    const footer = this.dom.get('#site-footer');
    if (!footer) return;

    let trigger = this.dom.get('#footer-trigger');
    if (!trigger) {
      trigger = document.createElement('div');
      trigger.id = 'footer-trigger';
      trigger.style.cssText = 'height: 100px; pointer-events: none;';
      footer.parentNode.insertBefore(trigger, footer);
    }

    this.observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && !this.footerManager.expanded) {
          this.footerManager.toggle();
        } else if (!entry.isIntersecting && this.footerManager.expanded) {
          this.footerManager.close();
        }
      },
      { threshold: 0.1 },
    );

    this.observer.observe(trigger);

    document.addEventListener('click', (e) => {
      if (this.footerManager.expanded && !e.target.closest('#site-footer')) {
        this.footerManager.close();
      }
    });
  }

  cleanup() {
    this.observer?.disconnect();
  }
}

export class SiteFooter extends HTMLElement {
  constructor() {
    super();
    this.dom = new DOM(this);
    this.analytics = new Analytics(this);
    this.banner = new CookieBanner(this.dom, this.analytics);
    this.settings = new CookieSettings(this.dom, this.analytics);
    this.footerManager = new FooterManager(this.dom);
    this.scrollHandler = new ScrollHandler(this.dom, this.footerManager);
  }

  async connectedCallback() {
    log.debug('SiteFooter connected');
    this.innerHTML = '<div id="footer-container" style="min-height: 100px;"></div>';
    await this.loadFooter();
  }

  async loadFooter() {
    const container = this.dom.get('#footer-container');
    if (!container) return;

    try {
      container.innerHTML = footerHtml;
      // Clear cache as DOM changed
      this.dom.clear();
      this.setup();

      log.info('Footer loaded');
      // Dispatch event to notify footer is loaded (used by SectionTracker)
      document.dispatchEvent(new CustomEvent('footer:loaded'));
    } catch (error) {
      log.error('Footer load failed', error);
      container.innerHTML = '<p>Footer konnte nicht geladen werden.</p>';
    }
  }

  setup() {
    this.updateYear();
    this.banner.init();
    this.scrollHandler.init();
    this.bindEvents();
  }

  updateYear() {
    const year = new Date().getFullYear();
    this.dom.getAll('.year').forEach((el) => (el.textContent = year));
  }

  bindEvents() {
    // We delegate click events from this component root to handle internal buttons
    this.addEventListener('click', (e) => {
      if (e.target.closest('[data-cookie-trigger]')) {
        e.preventDefault();
        e.stopPropagation();
        this.settings.open();
      }
    });

    const footerMin = this.dom.get('.footer-min');
    footerMin?.addEventListener('click', (e) => {
      if (e.target.closest('a, button, input, .cookie-inline')) {
        return;
      }
      this.footerManager.toggle();
    });

    const form = this.dom.get('.newsletter-form');
    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      const btn = form.querySelector('button');
      if (btn) {
        const original = btn.textContent;
        btn.textContent = '✓';
        btn.disabled = true;
        setTimeout(() => {
          btn.textContent = original;
          btn.disabled = false;
        }, 2000);
      }
      form.reset();
      a11y?.announce('Newsletter abonniert', { priority: 'polite' });
    });
  }

  disconnectedCallback() {
      this.scrollHandler.cleanup();
  }
}

customElements.define('site-footer', SiteFooter);
