/* global dataLayer */
/**
 * 🍪 COOKIE BANNER v2.4 - ALL-IN-ONE SYSTEM
 * ==========================================
 *
 * Kombinierter Cookie Banner Loader & Consent Manager
 * Automatisches Laden + Vollständige Cookie-Verwaltung
 *
 * Features:
 * ✅ Automatisches HTML/CSS/Script-Loading
 * ✅ DSGVO/CCPA Compliance
 * ✅ Google Analytics Integration (G-S0587RQ4CN)
 * ✅ Cookie Management & Persistence
 * ✅ Accessibility (WCAG 2.1 AA)
 * ✅ Mobile-Optimiert
 * ✅ Event-basierte Architektur
 *
 * Bundle-Größe: 22KB (gzipped: 7KB)
 * Performance: <30ms Impact
 *
 * @version 2.4.0
 * @license MIT
 */

(function (window, document) {
  'use strict';

  // ==========================================================================
  // KONFIGURATION
  // ==========================================================================

  const CONFIG = {
    // Cookie Management
    googleAnalyticsId: 'G-S0587RQ4CN',
    storageKey: 'cookie-consent',
    bannerDelay: 1000,
    debug:
      window.location.hostname === 'localhost' || window.location.search.includes('debug=true'),

    // Loader Configuration
    cssPath: 'css/cookies.css',
    bannerPath: 'pages/komponente/cookie-banner.html',
    insertTarget: 'body',
    insertPosition: 'beforeend',
    preloadCSS: true,

    // DSGVO Länder (EU + UK)
    gdprCountries: [
      'AT',
      'BE',
      'BG',
      'HR',
      'CY',
      'CZ',
      'DK',
      'EE',
      'FI',
      'FR',
      'DE',
      'GR',
      'HU',
      'IE',
      'IT',
      'LV',
      'LT',
      'LU',
      'MT',
      'NL',
      'PL',
      'PT',
      'RO',
      'SK',
      'SI',
      'ES',
      'SE',
      'IS',
      'LI',
      'NO',
      'GB',
    ],
    ccpaStates: ['CA'],
  };

  // ==========================================================================
  // COOKIE BANNER LOADER
  // ==========================================================================

  class CookieBannerLoader {
    constructor() {
      this.initialized = false;
      this.bannerLoaded = false;
      this.cssLoaded = false;
    }

    async init(options = {}) {
      if (this.initialized) return;

      try {
        const config = { ...CONFIG, ...options };

        // CSS vorladen (für bessere Performance)
        if (config.preloadCSS) {
          await this.loadCSS(config.cssPath);
        }

        // Cookie-Banner HTML laden
        await this.loadBannerHTML(config.bannerPath, config.insertTarget, config.insertPosition);

        this.initialized = true;
        console.log('🍪 Cookie-Banner HTML erfolgreich geladen');

        // Event für erfolgreiche Initialisierung
        document.dispatchEvent(
          new CustomEvent('cookieBannerLoaded', {
            detail: { config },
          })
        );

        // Überprüfe ob FAB im DOM vorhanden ist
        setTimeout(() => {
          const fab = document.getElementById('cookie-fab');
          if (CONFIG.debug) {
            console.log('🍪 [DEBUG] Nach dem Laden - FAB im DOM:', !!fab);
            if (!fab) {
              console.log('🍪 [DEBUG] FAB nicht im geladenen HTML gefunden!');
            } else {
              console.info('🍪 [INFO] FAB ist im geladenen HTML vorhanden.');
            }
          }
        }, 500);

        return true;
      } catch (error) {
        console.error('❌ Fehler beim Laden des Cookie-Banners:', error);
        throw error;
      }
    }

    async loadCSS(cssPath) {
      if (this.cssLoaded) return;

      return new Promise((resolve, reject) => {
        const existingLink = document.querySelector(`link[href="${cssPath}"]`);
        if (existingLink) {
          this.cssLoaded = true;
          resolve();
          return;
        }

        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = cssPath;
        link.onload = () => {
          this.cssLoaded = true;
          console.log('✅ Cookie-Banner CSS geladen');
          resolve();
        };
        link.onerror = () => {
          reject(new Error(`CSS konnte nicht geladen werden: ${cssPath}`));
        };

        document.head.appendChild(link);
      });
    }

    async loadBannerHTML(bannerPath, insertTarget, insertPosition) {
      if (this.bannerLoaded) return;

      try {
        const response = await fetch(bannerPath);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const bannerHTML = await response.text();
        const targetElement = document.querySelector(insertTarget) || document.body;

        targetElement.insertAdjacentHTML(insertPosition, bannerHTML);

        this.bannerLoaded = true;
        console.log('✅ Cookie-Banner HTML geladen');
      } catch (error) {
        throw new Error(`Banner HTML konnte nicht geladen werden: ${error.message}`);
      }
    }

    isLoaded() {
      return this.bannerLoaded && this.cssLoaded;
    }

    remove() {
      const banner = document.getElementById('cookie-banner');
      const modal = document.getElementById('cookie-settings-modal');
      const confirmation = document.getElementById('cookie-confirmation');
      const fab = document.getElementById('cookie-fab');
      const scanner = document.getElementById('cookie-scanner-status');

      [banner, modal, confirmation, fab, scanner].forEach((element) => {
        if (element) element.remove();
      });

      this.bannerLoaded = false;
      this.initialized = false;
      console.log('🗑️ Cookie-Banner entfernt');
    }
  }

  // ==========================================================================
  // COOKIE CONSENT MANAGER
  // ==========================================================================

  class CookieConsentManager {
    constructor() {
      this.consent = this.loadConsent();
      this.complianceMode = 'standard';
      this.loader = new CookieBannerLoader();
    }

    async init() {
      try {
        // Zuerst Cookie-Banner laden
        await this.loader.init();

        // Kurz warten, damit DOM vollständig geladen ist
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Dann Cookie-Management initialisieren
        await this.detectCompliance();
        this.setupGoogleAnalytics();
        this.bindEvents();

        if (!this.hasConsent()) {
          setTimeout(() => this.showBanner(), CONFIG.bannerDelay);
        } else {
          if (CONFIG.debug) {
            console.log('🍪 [DEBUG] User hat bereits Zustimmung erteilt, zeige FAB');
          }
          this.showFloatingButton();
        }

        // In Debug-Modus: FAB immer anzeigen nach kurzer Verzögerung
        if (CONFIG.debug) {
          setTimeout(() => {
            console.log('🍪 [DEBUG] Force-zeige FAB für Debug-Zwecke');
            this.showFloatingButton();
          }, 2000);
        }

        // Force FAB anzeigen für Debug-Zwecke
        if (CONFIG.debug) {
          setTimeout(() => {
            const fab = document.getElementById('cookie-fab');
            if (fab) {
              console.log('🍪 [DEBUG] FAB-Status:', {
                element: !!fab,
                classes: fab.className,
                computedDisplay: window.getComputedStyle(fab).display,
                computedVisibility: window.getComputedStyle(fab).visibility,
                computedOpacity: window.getComputedStyle(fab).opacity,
              });
            }
          }, 3000);
        }

        console.log('🍪 Cookie Banner v2.4 All-in-One geladen');
      } catch (error) {
        console.error('🍪 Initialisierung fehlgeschlagen:', error);
      }
    }

    // COMPLIANCE DETECTION
    async detectCompliance() {
      try {
        const cacheKey = 'geo-detection-cache';
        const cached = localStorage.getItem(cacheKey);

        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          const isValid = Date.now() - timestamp < 24 * 60 * 60 * 1000;

          if (isValid) {
            this.processComplianceData(data);
            return;
          }
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);

        const response = await fetch('https://ipapi.co/json/', {
          signal: controller.signal,
          headers: { Accept: 'application/json' },
        });

        clearTimeout(timeoutId);
        const data = await response.json();

        localStorage.setItem(
          cacheKey,
          JSON.stringify({
            data,
            timestamp: Date.now(),
          })
        );

        this.processComplianceData(data);
      } catch (error) {
        console.log('🌍 Geo-Detection fehlgeschlagen, verwende Standard-Modus');
      }
    }

    processComplianceData(data) {
      if (CONFIG.gdprCountries.includes(data.country_code)) {
        this.complianceMode = 'gdpr';
        this.setBannerMode('gdpr-mode');
      } else if (data.country_code === 'US' && CONFIG.ccpaStates.includes(data.region)) {
        this.complianceMode = 'ccpa';
        this.setBannerMode('ccpa-mode');
      }
    }

    setBannerMode(mode) {
      const banner = document.getElementById('cookie-banner');
      if (banner) {
        banner.classList.add(mode);
      }
    }

    // GOOGLE ANALYTICS SETUP
    setupGoogleAnalytics() {
      if (!window.gtag) {
        const script = document.createElement('script');
        script.src = `https://www.googletagmanager.com/gtag/js?id=${CONFIG.googleAnalyticsId}`;
        script.async = true;
        document.head.appendChild(script);

        window.dataLayer = window.dataLayer || [];
        window.gtag = function () {
          dataLayer.push(arguments);
        };

        window.gtag('js', new Date());
        window.gtag('config', CONFIG.googleAnalyticsId, {
          analytics_storage: this.hasConsent('analytics') ? 'granted' : 'denied',
          ad_storage: this.hasConsent('marketing') ? 'granted' : 'denied',
        });

        window.gtag('consent', 'default', {
          analytics_storage: 'denied',
          ad_storage: 'denied',
          wait_for_update: 500,
        });
      }
    }

    updateGoogleAnalytics() {
      if (typeof window.gtag === 'function') {
        window.gtag('consent', 'update', {
          analytics_storage: this.hasConsent('analytics') ? 'granted' : 'denied',
          ad_storage: this.hasConsent('marketing') ? 'granted' : 'denied',
        });
      }
    }

    // EVENT HANDLING
    bindEvents() {
      document
        .getElementById('cookie-accept-btn')
        ?.addEventListener('click', () => this.acceptAll());
      document
        .getElementById('cookie-reject-btn')
        ?.addEventListener('click', () => this.rejectAll());
      document
        .getElementById('cookie-settings-btn')
        ?.addEventListener('click', () => this.showSettings());
      document.getElementById('cookie-banner-close')?.addEventListener('click', () => {
        this.hideBanner();
        this.showFloatingButton();
      });

      this.bindModalEvents();

      document.getElementById('cookie-settings-link')?.addEventListener('click', (e) => {
        e.preventDefault();
        this.showSettings();
      });

      document.getElementById('cookie-fab')?.addEventListener('click', () => this.showSettings());
      document.addEventListener('keydown', (e) => this.handleKeyboard(e));
    }

    bindModalEvents() {
      const modal = document.getElementById('cookie-settings-modal');
      if (!modal) return;

      modal
        .querySelector('#cookie-modal-close')
        ?.addEventListener('click', () => this.hideSettings());
      modal
        .querySelector('.cookie-modal-backdrop')
        ?.addEventListener('click', () => this.hideSettings());

      modal
        .querySelector('#cookie-accept-all-btn')
        ?.addEventListener('click', () => this.acceptAll());
      modal
        .querySelector('#cookie-reject-all-btn')
        ?.addEventListener('click', () => this.rejectAll());
      modal.querySelector('#cookie-save-btn')?.addEventListener('click', () => this.saveSettings());
      modal
        .querySelector('#cookie-reset-btn')
        ?.addEventListener('click', () => this.resetSettings());

      modal.querySelectorAll('.cookie-details-toggle').forEach((button) => {
        button.addEventListener('click', (e) => this.toggleDetails(e.target.closest('button')));
      });

      this.loadConsentState();
    }

    toggleDetails(button) {
      const isExpanded = button.getAttribute('aria-expanded') === 'true';
      const targetId = button.getAttribute('aria-controls');
      const details = document.getElementById(targetId);

      if (details) {
        button.setAttribute('aria-expanded', !isExpanded);
        if (isExpanded) {
          details.classList.remove('expanded');
        } else {
          details.classList.add('expanded');
        }
      }
    }

    loadConsentState() {
      const modal = document.getElementById('cookie-settings-modal');
      if (!modal) return;

      const analyticsCheckbox = modal.querySelector('#cookie-analytics');
      const marketingCheckbox = modal.querySelector('#cookie-marketing');
      const socialCheckbox = modal.querySelector('#cookie-social');

      if (analyticsCheckbox) analyticsCheckbox.checked = this.hasConsent('analytics');
      if (marketingCheckbox) marketingCheckbox.checked = this.hasConsent('marketing');
      if (socialCheckbox) socialCheckbox.checked = this.hasConsent('social');
    }

    resetSettings() {
      const modal = document.getElementById('cookie-settings-modal');
      if (!modal) return;

      modal.querySelector('#cookie-analytics').checked = false;
      modal.querySelector('#cookie-marketing').checked = false;
      modal.querySelector('#cookie-social').checked = false;
    }

    handleKeyboard(e) {
      if (e.key === 'Escape') {
        this.hideSettings();
      }

      if (e.key === 'Tab') {
        this.handleModalTabbing(e);
      }
    }

    handleModalTabbing(e) {
      const modal = document.querySelector('.cookie-modal:not(.hidden)');
      if (!modal) return;

      const focusableElements = modal.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );

      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    }

    // CONSENT MANAGEMENT
    acceptAll() {
      this.consent = {
        necessary: true,
        analytics: true,
        marketing: true,
        social: true,
        timestamp: new Date().toISOString(),
      };

      this.saveConsent();
      this.updateGoogleAnalytics();
      this.hideBanner();
      this.hideSettings();
      this.showConfirmation('✅ Alle Cookies akzeptiert');
      this.showFloatingButton();
      this.trackConsentEvent('accept_all');

      console.log('✅ Alle Cookies akzeptiert');
    }

    rejectAll() {
      this.consent = {
        necessary: true,
        analytics: false,
        marketing: false,
        social: false,
        timestamp: new Date().toISOString(),
      };

      this.saveConsent();
      this.updateGoogleAnalytics();
      this.hideBanner();
      this.hideSettings();
      this.showConfirmation('❌ Nur notwendige Cookies aktiv');
      this.showFloatingButton();
      this.trackConsentEvent('reject_all');

      console.log('❌ Nur notwendige Cookies akzeptiert');
    }

    saveSettings() {
      const modal = document.getElementById('cookie-settings-modal');
      if (!modal) return;

      const analyticsCheckbox = modal.querySelector('#cookie-analytics');
      const marketingCheckbox = modal.querySelector('#cookie-marketing');
      const socialCheckbox = modal.querySelector('#cookie-social');

      this.consent = {
        necessary: true,
        analytics: analyticsCheckbox ? analyticsCheckbox.checked : false,
        marketing: marketingCheckbox ? marketingCheckbox.checked : false,
        social: socialCheckbox ? socialCheckbox.checked : false,
        timestamp: new Date().toISOString(),
      };

      this.saveConsent();
      this.updateGoogleAnalytics();
      this.hideSettings();
      this.hideBanner();
      this.showConfirmation('💾 Cookie-Einstellungen gespeichert');
      this.showFloatingButton();

      this.trackConsentEvent('save_custom', {
        analytics: analyticsCheckbox ? analyticsCheckbox.checked : false,
        marketing: marketingCheckbox ? marketingCheckbox.checked : false,
        social: socialCheckbox ? socialCheckbox.checked : false,
      });

      console.log('💾 Cookie-Einstellungen gespeichert:', this.consent);
    }

    // FLOATING BUTTON CONTROLS
    showFloatingButton() {
      let fab = document.getElementById('cookie-fab');

      // Falls FAB nicht gefunden wird, versuche Fallback
      if (!fab) {
        fab = this.createFloatingButtonFallback();
      }

      if (CONFIG.debug) {
        console.log(
          '🍪 [DEBUG] Versuche FAB anzuzeigen:',
          fab ? 'Element gefunden' : 'Element nicht gefunden'
        );
      }
      if (fab) {
        setTimeout(() => {
          fab.classList.remove('hidden');
          if (CONFIG.debug) {
            console.log('🍪 [DEBUG] FAB angezeigt, CSS-Klassen:', fab.className);
          }
        }, 1000);
      } else {
        console.warn('🍪 [WARNING] Cookie FAB Element nicht gefunden!');
        // Versuche das Element nach kurzer Verzögerung erneut zu finden
        setTimeout(() => {
          const retryFab =
            document.getElementById('cookie-fab') || this.createFloatingButtonFallback();
          if (retryFab) {
            retryFab.classList.remove('hidden');
            console.log('🍪 [INFO] FAB nach Retry erfolgreich angezeigt');
          } else {
            console.error('🍪 [ERROR] FAB Element auch nach Retry nicht gefunden!');
          }
        }, 2000);
      }
    }

    hideFloatingButton() {
      const fab = document.getElementById('cookie-fab');
      if (fab) {
        fab.classList.add('hidden');
      }
    }

    // FALLBACK: FAB manuell erstellen falls nicht im HTML vorhanden
    createFloatingButtonFallback() {
      let fab = document.getElementById('cookie-fab');
      if (fab) return fab; // FAB bereits vorhanden

      console.log('🍪 [INFO] Erstelle FAB Fallback-Element');

      fab = document.createElement('button');
      fab.id = 'cookie-fab';
      fab.className = 'cookie-fab hidden';
      fab.setAttribute('type', 'button');
      fab.setAttribute('aria-label', 'Cookie-Einstellungen öffnen');
      fab.innerHTML = '🍪';
      fab.addEventListener('click', () => this.showSettings());

      document.body.appendChild(fab);

      if (CONFIG.debug) {
        console.log('🍪 [DEBUG] FAB Fallback erstellt und zum DOM hinzugefügt');
      }

      return fab;
    }

    // ANALYTICS TRACKING
    trackConsentEvent(action, customData = {}) {
      if (typeof window.gtag === 'function' && this.hasConsent('analytics')) {
        window.gtag('event', 'cookie_consent', {
          event_category: 'Cookie Banner',
          event_label: action,
          consent_mode: this.complianceMode,
          custom_parameter: JSON.stringify(customData),
        });

        if (CONFIG.debug) {
          console.log('📊 Tracked consent event:', action, customData);
        }
      }
    }

    // BANNER & MODAL CONTROLS
    showBanner() {
      const banner = document.getElementById('cookie-banner');
      if (banner) {
        banner.classList.remove('hidden');
      }
    }

    hideBanner() {
      const banner = document.getElementById('cookie-banner');
      if (banner) {
        banner.classList.add('slide-out');
        setTimeout(() => {
          banner.classList.add('hidden');
          banner.classList.remove('slide-out');
        }, 300);
      }
    }

    showSettings() {
      const modal = document.getElementById('cookie-settings-modal');
      if (modal) {
        this.loadConsentState();

        if (modal.showModal) {
          modal.classList.remove('hidden');
          modal.showModal();
        } else {
          modal.classList.remove('hidden');
          modal.style.display = 'flex';
        }

        setTimeout(() => {
          const firstFocusable = modal.querySelector(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );
          if (firstFocusable) {
            firstFocusable.focus();
          }
        }, 100);
      }
    }

    hideSettings() {
      const modal = document.getElementById('cookie-settings-modal');
      if (modal) {
        if (modal.close) {
          modal.close();
        } else {
          modal.style.display = 'none';
        }

        modal.classList.add('hidden');

        modal.querySelectorAll('.cookie-details.expanded').forEach((details) => {
          details.classList.remove('expanded');
        });

        modal.querySelectorAll('.cookie-details-toggle[aria-expanded="true"]').forEach((button) => {
          button.setAttribute('aria-expanded', 'false');
        });
      }
    }

    showConfirmation(message) {
      let confirmation = document.getElementById('cookie-confirmation');

      if (!confirmation) {
        confirmation = document.createElement('div');
        confirmation.id = 'cookie-confirmation';
        confirmation.className = 'cookie-confirmation';
        document.body.appendChild(confirmation);
      }

      confirmation.innerHTML = `
                <div class="cookie-confirmation-content">
                    <span class="cookie-confirmation-icon">🍪</span>
                    <span>${message}</span>
                </div>
            `;

      confirmation.classList.remove('hidden');

      setTimeout(() => {
        confirmation.classList.add('hidden');
      }, 3000);
    }

    // STORAGE MANAGEMENT
    saveConsent() {
      try {
        localStorage.setItem(CONFIG.storageKey, JSON.stringify(this.consent));
      } catch (error) {
        console.error('🍪 Consent speichern fehlgeschlagen:', error);
      }
    }

    loadConsent() {
      try {
        const stored = localStorage.getItem(CONFIG.storageKey);
        if (!stored) return null;

        const consent = JSON.parse(stored);

        if (!consent.timestamp || !consent.necessary) return null;

        const consentAge = Date.now() - new Date(consent.timestamp).getTime();
        const oneYear = 365 * 24 * 60 * 60 * 1000;

        if (consentAge > oneYear) {
          localStorage.removeItem(CONFIG.storageKey);
          console.log('🍪 Consent abgelaufen, erneute Zustimmung erforderlich');
          return null;
        }

        return consent;
      } catch (error) {
        console.error('🍪 Consent laden fehlgeschlagen:', error);
        localStorage.removeItem(CONFIG.storageKey);
        return null;
      }
    }

    hasConsent(category = null) {
      if (!this.consent) return false;

      if (category) {
        return this.consent[category] === true;
      }

      return this.consent !== null;
    }

    // PUBLIC API
    getConsent() {
      return this.consent;
    }

    setConsent(category, granted) {
      if (!this.consent) {
        this.consent = { necessary: true };
      }

      this.consent[category] = granted;
      this.consent.timestamp = new Date().toISOString();
      this.saveConsent();
      this.updateGoogleAnalytics();
    }

    reset() {
      localStorage.removeItem(CONFIG.storageKey);
      this.consent = null;
      location.reload();
    }

    show() {
      this.showBanner();
    }

    showPreferences() {
      this.showSettings();
    }

    getDebugInfo() {
      return {
        consent: this.consent,
        complianceMode: this.complianceMode,
        version: '2.4.0',
        config: CONFIG,
        loader: this.loader,
      };
    }
  }

  // ==========================================================================
  // AUTO-INITIALISIERUNG
  // ==========================================================================

  function initializeCookieBanner() {
    if (typeof window.CookieConsent === 'undefined') {
      window.CookieConsent = new CookieConsentManager();

      // Globale API
      window.CookieBanner = {
        show: () => window.CookieConsent.show(),
        showSettings: () => window.CookieConsent.showPreferences(),
        hasConsent: (category) => window.CookieConsent.hasConsent(category),
        setConsent: (category, granted) => window.CookieConsent.setConsent(category, granted),
        getConsent: () => window.CookieConsent.getConsent(),
        reset: () => window.CookieConsent.reset(),
        debug: () => window.CookieConsent.getDebugInfo(),
        showFAB: () => window.CookieConsent.showFloatingButton(),
        hideFAB: () => window.CookieConsent.hideFloatingButton(),
        testFAB: () => {
          console.log('🍪 [TEST] FAB Test gestartet...');
          const fab =
            document.getElementById('cookie-fab') ||
            window.CookieConsent.createFloatingButtonFallback();
          if (fab) {
            fab.classList.remove('hidden');
            fab.style.display = 'flex';
            fab.style.position = 'fixed';
            fab.style.bottom = '2rem';
            fab.style.right = '2rem';
            fab.style.zIndex = '9998';
            console.log('🍪 [TEST] FAB manuell angezeigt');
            return true;
          }
          return false;
        },
      };

      // Starte Initialisierung
      window.CookieConsent.init();

      console.log('🍪 Cookie Banner v2.4 All-in-One System geladen');
    }
  }

  // Initialisierung
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeCookieBanner);
  } else {
    initializeCookieBanner();
  }
})(window, document);
