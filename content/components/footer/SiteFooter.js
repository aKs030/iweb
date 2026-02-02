// @ts-check
/**
 * Modern Site Footer Controller
 * Handles footer logic, scroll chaining, cookies, and analytics.
 * @version 11.0.0
 */

import { createLogger } from '/content/core/logger.js';
import { a11y } from '/content/core/accessibility-manager.js';
import { i18n } from '/content/core/i18n.js';

const log = createLogger('SiteFooter');

const CONFIG = {
  FOOTER_PATH: '/content/components/footer/footer.html',
};

/**
 * Cookie Management Utility
 */
const CookieManager = {
  /**
   * @param {string} name
   * @param {string} value
   * @param {number} [days=365]
   */
  set(name, value, days = 365) {
    const date = new Date();
    date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
    const expires = `; expires=${date.toUTCString()}`;
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${name}=${value || ''}${expires}; path=/; SameSite=Lax${secure}`;
  },

  /**
   * @param {string} name
   * @returns {string|null}
   */
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

  /**
   * @param {string} name
   */
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

/**
 * Analytics Manager
 */
class Analytics {
  load() {
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

  /**
   * @param {boolean} granted
   */
  updateConsent(granted) {
    const win = /** @type {any} */ (window);
    if (typeof win.gtag !== 'function') return;
    const status = granted ? 'granted' : 'denied';
    try {
      win.gtag('consent', 'update', {
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

/**
 * Main Footer Logic Controller
 */
class FooterController {
  /**
   * @param {HTMLElement} rootElement
   */
  constructor(rootElement) {
    this.root = rootElement;
    this.analytics = new Analytics();
    this.expanded = false;
    this.isTransitioning = false;
    this.touchStartY = 0;
    this.touchStartTime = 0;

    // Bind methods
    this.handleScroll = this.handleScroll.bind(this);
    this.handleWheel = this.handleWheel.bind(this);
    this.handleOutsideClick = this.handleOutsideClick.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleTouchStart = this.handleTouchStart.bind(this);
    this.handleTouchEnd = this.handleTouchEnd.bind(this);
    this.handleResize = this.handleResize.bind(this);

    this.init();
  }

  async init() {
    // Check if content needs to be loaded
    // We check for .footer-min as a sign that content exists
    if (!this.root.querySelector('.footer-min')) {
        try {
            const response = await fetch(CONFIG.FOOTER_PATH);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            this.root.innerHTML = await response.text();
            log.info('Footer content loaded remotely');
        } catch (e) {
            log.error('Failed to load footer content', e);
            return;
        }
    }

    this.elements = {
      footer: this.root,
      footerMin: this.root.querySelector('.footer-min'),
      footerMax: this.root.querySelector('.footer-max'),
      cookieBanner: this.root.querySelector('#cookie-banner'),
      cookieSettings: this.root.querySelector('#cookie-settings'),
      footerContent: this.root.querySelector('#footer-content'),
      acceptBtn: this.root.querySelector('#accept-cookies'),
      rejectBtn: this.root.querySelector('#reject-cookies'),
      closeBtn: this.root.querySelector('#close-settings'),
      analyticsToggle: this.root.querySelector('#analytics-toggle'),
      adsToggle: this.root.querySelector('#ads-toggle'),
      rejectAll: this.root.querySelector('#reject-all'),
      acceptSelected: this.root.querySelector('#accept-selected'),
      acceptAll: this.root.querySelector('#accept-all'),
    };

    this.setupDate();
    this.setupCookieBanner();
    this.setupScrollHandler();
    this.bindEvents();
    this.setupLanguageUpdates();

    this.root.dispatchEvent(new CustomEvent('footer:loaded', { bubbles: true }));
    log.info('Footer Controller initialized');
  }

  cleanup() {
    window.removeEventListener('scroll', this.handleScroll);
    window.removeEventListener('resize', this.handleResize);
    document.removeEventListener('click', this.handleOutsideClick);
    document.removeEventListener('keydown', this.handleKeyDown);
    document.removeEventListener('touchstart', this.handleTouchStart);
    document.removeEventListener('touchend', this.handleTouchEnd);
  }

  setupDate() {
    const year = new Date().getFullYear();
    this.root.querySelectorAll('.year').forEach(
      (el) => (el.textContent = String(year)),
    );
  }

  setupCookieBanner() {
    const { cookieBanner, acceptBtn, rejectBtn } = this.elements;
    if (!cookieBanner || !acceptBtn || !rejectBtn) return;

    const consent = CookieManager.get('cookie_consent');
    const shouldShow = consent !== 'accepted' && consent !== 'rejected';

    cookieBanner.classList.toggle('hidden', !shouldShow);

    if (consent === 'accepted') {
      this.analytics.updateConsent(true);
      this.analytics.load();
    } else if (consent === 'rejected') {
      this.analytics.updateConsent(false);
    }

    acceptBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.acceptCookies(cookieBanner);
    });

    rejectBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.rejectCookies(cookieBanner);
    });
  }

  /**
   * @param {HTMLElement} banner
   */
  acceptCookies(banner) {
    banner.style.animation = 'cookieSlideOut 0.3s ease-out forwards';
    setTimeout(() => banner.classList.add('hidden'), 300);
    CookieManager.set('cookie_consent', 'accepted');
    this.analytics.updateConsent(true);
    this.analytics.load();
    a11y?.announce('Cookies akzeptiert', { priority: 'polite' });
  }

  /**
   * @param {HTMLElement} banner
   */
  rejectCookies(banner) {
    banner.style.animation = 'cookieSlideOut 0.3s ease-out forwards';
    setTimeout(() => banner.classList.add('hidden'), 300);
    CookieManager.set('cookie_consent', 'rejected');
    this.analytics.updateConsent(false);
    a11y?.announce('Cookies abgelehnt', { priority: 'polite' });
  }

  /* ===== NEW SCROLL CHAINING LOGIC ===== */
  setupScrollHandler() {
    // 1. Global Scroll (Window) to Expand
    let scrollTimeout;
    window.addEventListener('scroll', () => {
        if (scrollTimeout) return;
        scrollTimeout = setTimeout(() => {
            this.handleScroll();
            scrollTimeout = null;
        }, 50);
    }, { passive: true });

    // 2. Local Scroll (Footer Max) to Collapse
    const { footerMax } = this.elements;
    if (footerMax) {
        footerMax.addEventListener('wheel', this.handleWheel, { passive: true });
        footerMax.addEventListener('touchmove', this.handleWheel, { passive: true });
    }
  }

  handleScroll() {
    if (this.expanded || this.isTransitioning) return;

    // Improved page detection logic to prevent auto-expand on specific pages
    const currentPath = window.location.pathname;
    const noAutoExpandPages = ['/projekte/', '/projekte/index.html'];
    if (noAutoExpandPages.some((path) => currentPath.includes(path))) {
        return;
    }

    // Expand when reaching the very bottom
    const scrollBottom = window.scrollY + window.innerHeight;
    const docHeight = document.documentElement.scrollHeight;

    // Threshold of 20px from bottom
    if (scrollBottom >= docHeight - 20) {
        this.toggleFooter(true);
    }
  }

  handleWheel(e) {
    if (!this.expanded || this.isTransitioning) return;

    const { footerMax } = this.elements;
    if (!footerMax) return;

    // Check if we are at the top of the footer content
    const atTop = footerMax.scrollTop <= 0;

    let isScrollingUp = false;
    if (e.type === 'wheel') {
        isScrollingUp = e.deltaY < 0;
    }
    // Touch logic handled in global touch handlers

    if (atTop && isScrollingUp) {
        // User wants to go back to page
        this.toggleFooter(false);
    }
  }
  /* =================================== */

  setupGlobalEventListeners() {
    document.addEventListener('click', this.handleOutsideClick, { passive: false });
    document.addEventListener('keydown', this.handleKeyDown, { passive: false });
    document.addEventListener('touchstart', this.handleTouchStart, { passive: true });
    document.addEventListener('touchend', this.handleTouchEnd, { passive: false });
    window.addEventListener('resize', this.handleResize, { passive: true });
  }

  handleOutsideClick(e) {
    if (this.expanded && !this.elements.footer.contains(e.target) && !this.isTransitioning) {
      this.toggleFooter(false);
    }
  }

  handleKeyDown(e) {
    if (!this.expanded) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      this.toggleFooter(false);
    }
  }

  handleTouchStart(e) {
    if (this.elements.footer.contains(e.target)) {
        this.touchStartY = e.touches[0].clientY;
        this.touchStartTime = Date.now();
    }
  }

  handleTouchEnd(e) {
    if (!this.elements.footer.contains(e.target)) return;
    if (this.isTransitioning) return;

    const touchEndY = e.changedTouches[0].clientY;
    const touchDuration = Date.now() - this.touchStartTime;
    const touchDistance = touchEndY - this.touchStartY; // +ve is down, -ve is up

    if (touchDuration > 500) return; // Too slow, likely scrolling

    if (!this.expanded) {
        // Swipe UP to open
        if (touchDistance < -30) {
            this.toggleFooter(true);
        }
    } else {
        // Swipe DOWN to close
        if (this.elements.footerMax.scrollTop <= 0 && touchDistance > 30) {
            e.preventDefault();
            this.toggleFooter(false);
        }
    }
  }

  handleResize() {
    if (this.resizeTimeout) clearTimeout(this.resizeTimeout);
    this.resizeTimeout = setTimeout(() => {
      if (this.expanded) {
        this.elements.footer.scrollIntoView({ block: 'end' });
      }
    }, 150);
  }

  /**
   * @param {boolean} [forceState]
   */
  toggleFooter(forceState) {
    const { footer, footerMin, footerMax } = this.elements;
    if (!footer || this.isTransitioning) return;

    const newState = forceState !== undefined ? forceState : !this.expanded;
    if (newState === this.expanded) return;

    this.isTransitioning = true;
    this.expanded = newState;

    if (this.expanded) {
      footer.classList.add('expanded');
      document.body.classList.add('footer-expanded');
      footerMin?.classList.add('hidden');
      footerMax?.classList.remove('hidden');

      const firstFocusable = footerMax?.querySelector('button, a, input');
      if (firstFocusable) /** @type {HTMLElement} */(firstFocusable).focus();

      a11y?.announce('Footer erweitert', { priority: 'polite' });
    } else {
      footer.classList.remove('expanded');
      document.body.classList.remove('footer-expanded');
      footerMin?.classList.remove('hidden');
      footerMax?.classList.add('hidden');

      a11y?.announce('Footer minimiert', { priority: 'polite' });
    }

    setTimeout(() => {
      this.isTransitioning = false;
    }, 300);
  }

  openSettings() {
    const { cookieSettings, footerContent, analyticsToggle, adsToggle } = this.elements;
    if (!cookieSettings) return;

    const consent = CookieManager.get('cookie_consent');
    if (analyticsToggle) /** @type {HTMLInputElement} */(analyticsToggle).checked = consent === 'accepted';
    if (adsToggle) /** @type {HTMLInputElement} */(adsToggle).checked = false;

    if (!this.expanded) this.toggleFooter(true);

    cookieSettings.classList.remove('hidden');
    footerContent?.classList.add('hidden');

    const closeBtn = cookieSettings.querySelector('#close-settings');
    if (closeBtn) /** @type {HTMLElement} */(closeBtn).focus();
  }

  closeSettings() {
    const { cookieSettings, footerContent } = this.elements;
    cookieSettings?.classList.add('hidden');
    footerContent?.classList.remove('hidden');
  }

  bindEvents() {
    const { closeBtn, footerMin } = this.elements;

    document.addEventListener('click', (e) => {
      const target = /** @type {Element} */ (e.target);
      if (target.closest('[data-footer-trigger]')) {
        e.preventDefault();
        this.toggleFooter(true);
      }
      if (target.closest('[data-cookie-trigger]')) {
        e.preventDefault();
        this.openSettings();
      }
    });

    closeBtn?.addEventListener('click', () => this.closeSettings());

    footerMin?.addEventListener('click', (e) => {
      const target = /** @type {Element} */ (e.target);
      if (target.closest('a, button, input, .cookie-inline')) return;
      if (!this.isTransitioning) this.toggleFooter();
    });

    footerMin?.addEventListener('keydown', (e) => {
      const target = /** @type {Element} */ (e.target);
      if ((e.key === 'Enter' || e.key === ' ') && !target.closest('a, button')) {
        e.preventDefault();
        this.toggleFooter();
      }
    });

    this.setupGlobalEventListeners();
    this.bindSettingsButtons();
  }

  bindSettingsButtons() {
    const { rejectAll, acceptSelected, acceptAll, analyticsToggle, cookieBanner } = this.elements;

    rejectAll?.addEventListener('click', () => {
      CookieManager.set('cookie_consent', 'rejected');
      CookieManager.deleteAnalytics();
      this.analytics.updateConsent(false);
      cookieBanner?.classList.add('hidden');
      this.closeSettings();
    });

    acceptSelected?.addEventListener('click', () => {
      const analyticsEnabled = /** @type {HTMLInputElement|null} */(analyticsToggle)?.checked ?? false;
      CookieManager.set('cookie_consent', analyticsEnabled ? 'accepted' : 'rejected');
      if (analyticsEnabled) {
        this.analytics.updateConsent(true);
        this.analytics.load();
      } else {
        this.analytics.updateConsent(false);
        CookieManager.deleteAnalytics();
      }
      cookieBanner?.classList.add('hidden');
      this.closeSettings();
    });

    acceptAll?.addEventListener('click', () => {
      CookieManager.set('cookie_consent', 'accepted');
      this.analytics.updateConsent(true);
      this.analytics.load();
      cookieBanner?.classList.add('hidden');
      this.closeSettings();
    });
  }

  setupLanguageUpdates() {
    i18n.subscribe((_lang) => this.updateLanguage());
  }

  updateLanguage() {
    this.root.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      if (key) el.textContent = i18n.t(key);
    });
  }
}

// Initialize on DOM Ready
const init = () => {
  // Check for static footer first
  const footerEl = document.getElementById('site-footer');
  if (footerEl) {
    if (!footerEl.dataset.initialized) {
        try {
            new FooterController(footerEl);
            footerEl.dataset.initialized = 'true';
        } catch (e) {
            console.error('SiteFooter init error:', e);
        }
    }
    return;
  }

  // Check for custom element if no static footer (dynamic case)
  const customFooter = document.querySelector('site-footer');
  if (customFooter) {
      if (!customFooter.dataset.initialized) {
          new FooterController(/** @type {HTMLElement} */(customFooter));
          customFooter.dataset.initialized = 'true';
      }
      return;
  }

  // If neither found, retry if document is still loading or shortly after
  if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
  } else {
      // Retry once after a short delay to handle async injection or parsing timing
      setTimeout(() => {
          const retryFooter = document.getElementById('site-footer') || document.querySelector('site-footer');
          if (retryFooter && !retryFooter.dataset.initialized) {
              new FooterController(/** @type {HTMLElement} */(retryFooter));
              retryFooter.dataset.initialized = 'true';
          }
      }, 100);
  }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// Wrapper for custom element
export class SiteFooter extends HTMLElement {
  connectedCallback() {
    // Self-initialize if not already done by global init
    if (!this.dataset.initialized) {
        new FooterController(this);
        this.dataset.initialized = 'true';
    }
  }
}

try {
    customElements.define('site-footer', SiteFooter);
} catch(e) {}
