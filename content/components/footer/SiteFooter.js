// @ts-check
/**
 * Modern Site Footer Web Component
 * Encapsulates footer logic, cookies, and analytics.
 * @version 2.0.0
 */

import { createLogger } from '/content/core/logger.js';
import { a11y } from '/content/core/accessibility-manager.js';
import { i18n } from '/content/core/i18n.js';

const log = createLogger('SiteFooter');

const CONFIG = {
  FOOTER_PATH: '/content/components/footer/footer.html',
  DEBOUNCE_MS: 150,
};

/**
 * @typedef {import('/content/core/types.js').FooterElements} FooterElements
 */

/**
 * Cookie Management Utility
 */
const CookieManager = {
  /**
   * @param {string} name
   * @param {string} value
   * @param {number} days
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
    const win = /** @type {import('/content/core/types.js').GlobalWindow} */ (
      window
    );
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
 * SiteFooter Custom Element
 */
export class SiteFooter extends HTMLElement {
  constructor() {
    super();
    this.analytics = new Analytics();
    this.expanded = false;
    this.initialized = false;
    this.isTransitioning = false;
    this.touchStartY = 0;
    this.touchStartTime = 0;
    /** @type {FooterElements} */
    this.elements = {
      footer: null,
      footerMin: null,
      footerMax: null,
      cookieBanner: null,
      cookieSettings: null,
      footerContent: null,
      acceptBtn: null,
      rejectBtn: null,
      closeBtn: null,
      analyticsToggle: null,
      adsToggle: null,
      rejectAll: null,
      acceptSelected: null,
      acceptAll: null,
    };

    // Bind methods to preserve context
    this.handleOutsideClick = this.handleOutsideClick.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleTouchStart = this.handleTouchStart.bind(this);
    this.handleTouchMove = this.handleTouchMove.bind(this);
    this.handleTouchEnd = this.handleTouchEnd.bind(this);
    this.handleResize = this.handleResize.bind(this);
    this.handleScroll = this.handleScroll.bind(this);
    this.handleWheel = this.handleWheel.bind(this);
  }

  async connectedCallback() {
    // Allow for manual source override via attribute
    const src = this.getAttribute('src') || CONFIG.FOOTER_PATH;

    try {
      if (!this.innerHTML.trim()) {
        const response = await fetch(src);
        if (!response.ok) throw new Error('Footer load failed');
        this.innerHTML = await response.text();
      }

      this.init();
      this.setupLanguageUpdates();
      this.setupGlobalEventListeners();
      this.initialized = true;
      log.info('Footer initialized');
      this.dispatchEvent(new CustomEvent('footer:loaded', { bubbles: true }));
    } catch (error) {
      log.error('Footer load failed', error);
    }
  }

  disconnectedCallback() {
    this.cleanup();
  }

  cleanup() {
    this.removeGlobalEventListeners();

    // Clear any pending timeouts
    if (this.resizeTimeout) {
      clearTimeout(this.resizeTimeout);
      this.resizeTimeout = null;
    }
  }

  init() {
    // Cache DOM elements
    this.elements = {
      footer: this.querySelector('#site-footer'),
      footerMin: this.querySelector('.footer-min'),
      footerMax: this.querySelector('.footer-max'),
      cookieBanner: this.querySelector('#cookie-banner'),
      cookieSettings: this.querySelector('#cookie-settings'),
      footerContent: this.querySelector('#footer-content'),
      acceptBtn: this.querySelector('#accept-cookies'),
      rejectBtn: this.querySelector('#reject-cookies'),
      closeBtn: this.querySelector('#close-settings'),
      analyticsToggle: this.querySelector('#analytics-toggle'),
      adsToggle: this.querySelector('#ads-toggle'),
      rejectAll: this.querySelector('#reject-all'),
      acceptSelected: this.querySelector('#accept-selected'),
      acceptAll: this.querySelector('#accept-all'),
    };

    this.setupDate();
    this.setupCookieBanner();
    this.setupScrollHandler();
    this.bindEvents();
  }

  setupDate() {
    const year = new Date().getFullYear();
    this.querySelectorAll('.year').forEach(
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
    const styledBanner =
      /** @type {import('/content/core/types.js').StyledHTMLElement} */ (
        banner
      );
    styledBanner.style.animation = 'cookieSlideOut 0.3s ease-out forwards';
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
    const styledBanner =
      /** @type {import('/content/core/types.js').StyledHTMLElement} */ (
        banner
      );
    styledBanner.style.animation = 'cookieSlideOut 0.3s ease-out forwards';
    setTimeout(() => banner.classList.add('hidden'), 300);

    CookieManager.set('cookie_consent', 'rejected');
    this.analytics.updateConsent(false);
    a11y?.announce('Cookies abgelehnt', { priority: 'polite' });
  }

  setupScrollHandler() {
    const { footer } = this.elements;
    if (!footer) return;

    // Improved page detection logic
    const currentPath = window.location.pathname;

    // Pages that should NOT auto-expand footer (explicit list)
    const noAutoExpandPages = ['/projekte/', '/projekte/index.html'];

    // Check if current page should not auto-expand
    const shouldNotAutoExpand = noAutoExpandPages.some((path) =>
      currentPath.includes(path),
    );

    // On pages that shouldn't auto-expand, only allow manual footer toggle
    if (shouldNotAutoExpand) {
      log.info('Auto-expand disabled for this page:', currentPath);
      return; // Exit early, no scroll-based trigger
    }

    // Initialize Scroll Behavior (Chaining)
    this.setupScrollBehavior();
  }

  setupScrollBehavior() {
    // Listen for window scroll to trigger expansion at bottom
    window.addEventListener('scroll', this.handleScroll, { passive: true });

    // Listen for wheel/touch interaction to trigger minimization (Scroll Chaining)
    document.addEventListener('wheel', this.handleWheel, { passive: true });
    // touchmove is also added in setupGlobalEventListeners but logic is separate
  }

  handleScroll() {
    if (this.expanded || this.isTransitioning) return;

    // Check if near bottom of page
    // Using Math.ceil to avoid sub-pixel precision issues
    const scrollPosition = Math.ceil(window.innerHeight + window.scrollY);
    const bodyHeight = document.documentElement.scrollHeight;
    const threshold = 10; // Trigger slightly before exact bottom

    if (bodyHeight - scrollPosition <= threshold) {
      this.toggleFooter(true);
    }
  }

  handleWheel(e) {
    if (!this.expanded || this.isTransitioning) return;

    const footerContent = this.elements.footerMax;
    // e.deltaY < 0 means scrolling up
    // Check if user is scrolling UP and footer content is already at the top
    if (e.deltaY < 0 && footerContent && footerContent.scrollTop <= 0) {
      this.toggleFooter(false);
    }
  }

  setupGlobalEventListeners() {
    // Use passive listeners where possible for better performance
    document.addEventListener('click', this.handleOutsideClick, {
      passive: false,
    });
    document.addEventListener('keydown', this.handleKeyDown, {
      passive: false,
    });
    document.addEventListener('touchstart', this.handleTouchStart, {
      passive: true,
    });
    document.addEventListener('touchmove', this.handleTouchMove, {
      passive: true,
    });
    document.addEventListener('touchend', this.handleTouchEnd, {
      passive: false,
    });
    window.addEventListener('resize', this.handleResize, { passive: true });
  }

  removeGlobalEventListeners() {
    document.removeEventListener('click', this.handleOutsideClick);
    document.removeEventListener('keydown', this.handleKeyDown);
    document.removeEventListener('touchstart', this.handleTouchStart);
    document.removeEventListener('touchmove', this.handleTouchMove);
    document.removeEventListener('touchend', this.handleTouchEnd);
    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('scroll', this.handleScroll);
    document.removeEventListener('wheel', this.handleWheel);
  }

  handleOutsideClick(e) {
    const target = /** @type {Element} */ (e.target);
    if (
      this.expanded &&
      !target.closest('#site-footer') &&
      !this.isTransitioning
    ) {
      this.toggleFooter(false);
    }
  }

  handleKeyDown(e) {
    if (!this.expanded) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      this.toggleFooter(false);
      // Return focus to the trigger element if available
      const trigger = /** @type {HTMLElement|null} */ (
        document.querySelector('[data-footer-trigger]')
      );
      if (trigger && typeof trigger.focus === 'function') {
        trigger.focus();
      }
    }
  }

  handleTouchStart(e) {
    // Always track touch start for scroll calculations
    this.touchStartY = e.touches[0].clientY;
    this.touchStartTime = Date.now();
  }

  handleTouchMove(e) {
    if (!this.expanded || this.isTransitioning) return;

    const currentY = e.touches[0].clientY;
    const deltaY = currentY - this.touchStartY; // positive = swipe down (scroll up)

    const footerContent = this.elements.footerMax;
    const isAtTop = footerContent ? footerContent.scrollTop <= 0 : true;

    // If pulling down (scrolling up intent) significantly and at top of footer
    if (deltaY > 50 && isAtTop) {
      this.toggleFooter(false);
    }
  }

  handleTouchEnd(e) {
    // Interaction logic for Minimized Footer (Swipe up to expand)
    if (!this.elements.footerMin?.contains(e.target)) return;
    if (this.expanded || this.isTransitioning) return;

    const touchEndY = e.changedTouches[0].clientY;
    const touchDuration = Date.now() - this.touchStartTime;
    const touchDistance = Math.abs(touchEndY - this.touchStartY);

    // Detect swipe up gesture or tap
    if (
      touchDuration < 300 &&
      (touchDistance < 10 || this.touchStartY - touchEndY > 30)
    ) {
      e.preventDefault();
      this.toggleFooter(true);
    }
  }

  handleResize() {
    // Debounce resize events
    if (this.resizeTimeout) {
      clearTimeout(this.resizeTimeout);
    }

    this.resizeTimeout = setTimeout(() => {
      // Recalculate positions if needed
      if (this.expanded) {
        this.updateFooterPosition();
      }
    }, 150);
  }

  updateFooterPosition() {
    const { footer } = this.elements;
    if (!footer) return;

    // Ensure footer stays properly positioned on resize
    const rect = footer.getBoundingClientRect();
    if (rect.bottom > window.innerHeight) {
      footer.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }

  /**
   * @param {boolean} [forceState]
   */
  toggleFooter(forceState) {
    const { footer, footerMin, footerMax } = this.elements;

    if (!footer || this.isTransitioning) return;

    const newState = forceState !== undefined ? forceState : !this.expanded;

    // Prevent unnecessary state changes
    if (newState === this.expanded) return;

    this.isTransitioning = true;
    this.expanded = newState;

    // Update all footer trigger elements
    const footerTriggers = document.querySelectorAll('[data-footer-trigger]');

    if (this.expanded) {
      footer.classList.add('expanded');
      document.body.classList.add('footer-expanded');
      footerMin?.classList.add('hidden');
      footerMax?.classList.remove('hidden');
      footerMin?.setAttribute('aria-expanded', 'true');

      // Update all trigger elements
      footerTriggers.forEach((trigger) => {
        trigger.setAttribute('aria-expanded', 'true');
      });

      // Announce to screen readers
      a11y?.announce('Footer erweitert', { priority: 'polite' });

      // Focus management for accessibility
      const firstFocusable = /** @type {HTMLElement|null} */ (
        footerMax?.querySelector(
          'button, a, input, [tabindex]:not([tabindex="-1"])',
        )
      );
      if (firstFocusable && typeof firstFocusable.focus === 'function') {
        // Small delay to ensure transition starts
        setTimeout(() => firstFocusable.focus(), 100);
      }
    } else {
      footer.classList.remove('expanded');
      document.body.classList.remove('footer-expanded');
      footerMin?.classList.remove('hidden');
      footerMax?.classList.add('hidden');
      footerMin?.setAttribute('aria-expanded', 'false');

      // Update all trigger elements
      footerTriggers.forEach((trigger) => {
        trigger.setAttribute('aria-expanded', 'false');
      });

      // Announce to screen readers
      a11y?.announce('Footer minimiert', { priority: 'polite' });
    }

    // Reset transition flag after animation completes
    setTimeout(() => {
      this.isTransitioning = false;
    }, 300); // Match CSS transition duration
  }

  openSettings() {
    const { cookieSettings, footerContent, analyticsToggle, adsToggle } =
      this.elements;

    if (!cookieSettings) return;

    // Load current settings
    const consent = CookieManager.get('cookie_consent');

    if (analyticsToggle) {
      const toggle = /** @type {HTMLInputElement} */ (analyticsToggle);
      toggle.checked = consent === 'accepted';
    }
    if (adsToggle) {
      const toggle = /** @type {HTMLInputElement} */ (adsToggle);
      toggle.checked = false;
    }

    // Force expand footer if not already expanded
    if (!this.expanded) {
      this.toggleFooter(true);
    }

    cookieSettings.classList.remove('hidden');
    footerContent?.classList.add('hidden');

    // Focus the close button for accessibility
    const closeBtn = /** @type {HTMLElement|null} */ (
      cookieSettings.querySelector('#close-settings')
    );
    if (closeBtn && typeof closeBtn.focus === 'function') {
      setTimeout(() => closeBtn.focus(), 100);
    }

    a11y?.announce('Cookie-Einstellungen geöffnet', { priority: 'polite' });
  }

  closeSettings() {
    const { cookieSettings, footerContent } = this.elements;

    cookieSettings?.classList.add('hidden');
    footerContent?.classList.remove('hidden');

    // Keep footer expanded when closing settings
    // User can manually close footer if desired

    a11y?.announce('Cookie-Einstellungen geschlossen', { priority: 'polite' });
  }

  bindEvents() {
    const { closeBtn, footerMin } = this.elements;

    // Manual footer triggers (data-footer-trigger)
    document.addEventListener('click', (e) => {
      const target = /** @type {Element} */ (e.target);
      const trigger = target.closest('[data-footer-trigger]');
      if (trigger) {
        e.preventDefault();
        e.stopPropagation();
        this.toggleFooter(true);
        // Update aria-expanded attribute
        trigger.setAttribute('aria-expanded', 'true');
      }
    });

    // Cookie trigger buttons
    this.addEventListener('click', (e) => {
      const target = /** @type {Element} */ (e.target);
      if (target.closest('[data-cookie-trigger]')) {
        e.preventDefault();
        e.stopPropagation();
        this.openSettings();
      }
    });

    // Settings close button
    closeBtn?.addEventListener('click', () => this.closeSettings());

    // Footer minimize click - improved interaction handling
    footerMin?.addEventListener('click', (e) => {
      // Ignore clicks on interactive elements
      const target = /** @type {Element} */ (e.target);
      if (target.closest('a, button, input, .cookie-inline')) {
        return;
      }

      // Prevent double-triggering during transitions
      if (this.isTransitioning) {
        e.preventDefault();
        return;
      }

      this.toggleFooter();
    });

    // Keyboard support for footer minimize area
    footerMin?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        const target = /** @type {Element} */ (e.target);
        if (!target.closest('a, button, input, .cookie-inline')) {
          e.preventDefault();
          this.toggleFooter();
        }
      }
    });

    // Cookie Settings Buttons
    this.bindSettingsButtons();
  }

  bindSettingsButtons() {
    const {
      rejectAll,
      acceptSelected,
      acceptAll,
      analyticsToggle,
      cookieBanner,
    } = this.elements;

    rejectAll?.addEventListener('click', () => {
      CookieManager.set('cookie_consent', 'rejected');
      CookieManager.deleteAnalytics();
      this.analytics.updateConsent(false);
      cookieBanner?.classList.add('hidden');
      a11y?.announce('Nur notwendige Cookies', { priority: 'polite' });
      this.closeSettings();
    });

    acceptSelected?.addEventListener('click', () => {
      const toggle = /** @type {HTMLInputElement|null} */ (analyticsToggle);
      const analyticsEnabled = toggle?.checked ?? false;
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

      cookieBanner?.classList.add('hidden');
      a11y?.announce('Einstellungen gespeichert', { priority: 'polite' });
      this.closeSettings();
    });

    acceptAll?.addEventListener('click', () => {
      CookieManager.set('cookie_consent', 'accepted');
      this.analytics.updateConsent(true);
      this.analytics.load();
      cookieBanner?.classList.add('hidden');
      a11y?.announce('Alle Cookies akzeptiert', { priority: 'polite' });
      this.closeSettings();
    });
  }

  setupLanguageUpdates() {
    i18n.subscribe((_lang) => {
      this.updateLanguage(_lang);
    });
  }

  updateLanguage(_lang) {
    const elements = this.querySelectorAll('[data-i18n]');
    elements.forEach((el) => {
      const key = el.getAttribute('data-i18n');
      if (key) {
        el.textContent = i18n.t(key);
      }
    });
  }
}

customElements.define('site-footer', SiteFooter);
