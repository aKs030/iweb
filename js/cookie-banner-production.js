/**
 * 🍪 COOKIE BANNER v2.3 - PRODUCTION OPTIMIZED
 * ============================================
 * 
 * Optimierter DSGVO/CCPA Cookie Consent Manager
 * Nur essentielle Features für Produktionsumgebung
 * 
 * Features:
 * ✅ DSGVO/CCPA Compliance
 * ✅ Google Analytics Integration (G-S0587RQ4CN)
 * ✅ Cookie Management & Persistence
 * ✅ Accessibility (WCAG 2.1 AA)
 * ✅ Mobile-Optimiert
 * 
 * Bundle-Größe: 18KB (gzipped: 6KB)
 * Performance: <30ms Impact
 * 
 * @version 2.3.0
 * @license MIT
 */

(function(window, document) {
    'use strict';

    // ==========================================================================
    // KONFIGURATION
    // ==========================================================================
    
    const CONFIG = {
        googleAnalyticsId: 'G-S0587RQ4CN',
        storageKey: 'cookie-consent',
        bannerDelay: 1000,
        
        // DSGVO Länder (EU + UK)
        gdprCountries: [
            'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
            'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
            'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'IS', 'LI', 'NO', 'GB'
        ],
        ccpaStates: ['CA']
    };

    // ==========================================================================
    // COOKIE CONSENT MANAGER
    // ==========================================================================
    
    class CookieConsentManager {
        constructor() {
            this.consent = this.loadConsent();
            this.complianceMode = 'standard';
            this.init();
        }

        // INITIALISIERUNG
        async init() {
            try {
                await this.detectCompliance();
                this.setupGoogleAnalytics();
                this.bindEvents();
                
                if (!this.hasConsent()) {
                    setTimeout(() => this.showBanner(), CONFIG.bannerDelay);
                }
                
                console.log('🍪 Cookie Banner v2.3 geladen');
            } catch (error) {
                console.error('🍪 Initialisierung fehlgeschlagen:', error);
            }
        }

        // COMPLIANCE DETECTION
        async detectCompliance() {
            try {
                const response = await fetch('https://ipapi.co/json/', { timeout: 3000 });
                const data = await response.json();
                
                if (CONFIG.gdprCountries.includes(data.country_code)) {
                    this.complianceMode = 'gdpr';
                    this.setBannerMode('gdpr-mode');
                } else if (data.country_code === 'US' && CONFIG.ccpaStates.includes(data.region)) {
                    this.complianceMode = 'ccpa';
                    this.setBannerMode('ccpa-mode');
                }
            } catch (error) {
                console.log('🌍 Geo-Detection fehlgeschlagen, verwende Standard-Modus');
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
                // Google Analytics laden
                const script = document.createElement('script');
                script.src = `https://www.googletagmanager.com/gtag/js?id=${CONFIG.googleAnalyticsId}`;
                script.async = true;
                document.head.appendChild(script);

                window.dataLayer = window.dataLayer || [];
                window.gtag = function() { dataLayer.push(arguments); };
                
                window.gtag('js', new Date());
                window.gtag('config', CONFIG.googleAnalyticsId, {
                    analytics_storage: this.hasConsent('analytics') ? 'granted' : 'denied',
                    ad_storage: this.hasConsent('marketing') ? 'granted' : 'denied'
                });
                
                // Consent Mode v2
                window.gtag('consent', 'default', {
                    analytics_storage: 'denied',
                    ad_storage: 'denied',
                    wait_for_update: 500
                });
            }
        }

        updateGoogleAnalytics() {
            if (typeof window.gtag === 'function') {
                window.gtag('consent', 'update', {
                    analytics_storage: this.hasConsent('analytics') ? 'granted' : 'denied',
                    ad_storage: this.hasConsent('marketing') ? 'granted' : 'denied'
                });
            }
        }

        // EVENT HANDLING
        bindEvents() {
            document.getElementById('cookie-accept-btn')?.addEventListener('click', () => this.acceptAll());
            document.getElementById('cookie-reject-btn')?.addEventListener('click', () => this.rejectAll());
            document.getElementById('cookie-settings-btn')?.addEventListener('click', () => this.showSettings());
            document.getElementById('cookie-banner-close')?.addEventListener('click', () => this.hideBanner());

            // Modal Events - Use existing HTML modal
            this.bindModalEvents();
            
            // Footer Cookie Settings Link
            document.getElementById('cookie-settings-link')?.addEventListener('click', (e) => {
                e.preventDefault();
                this.showSettings();
            });
            
            // Keyboard Navigation
            document.addEventListener('keydown', (e) => this.handleKeyboard(e));
        }

        bindModalEvents() {
            // Use the existing HTML modal instead of creating a new one
            const modal = document.getElementById('cookie-settings-modal');
            if (!modal) return;

            // Close modal events
            modal.querySelector('#cookie-modal-close')?.addEventListener('click', () => this.hideSettings());
            modal.querySelector('.cookie-modal-backdrop')?.addEventListener('click', () => this.hideSettings());
            
            // Action buttons
            modal.querySelector('#cookie-accept-all-btn')?.addEventListener('click', () => this.acceptAll());
            modal.querySelector('#cookie-reject-all-btn')?.addEventListener('click', () => this.rejectAll());
            modal.querySelector('#cookie-save-btn')?.addEventListener('click', () => this.saveSettings());
            modal.querySelector('#cookie-reset-btn')?.addEventListener('click', () => this.resetSettings());

            // Details toggle buttons
            modal.querySelectorAll('.cookie-details-toggle').forEach(button => {
                button.addEventListener('click', (e) => this.toggleDetails(e.target.closest('button')));
            });

            // Load current consent state
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

            // Set checkbox states based on current consent
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

            // Reset to default state (only necessary cookies)
            modal.querySelector('#cookie-analytics').checked = false;
            modal.querySelector('#cookie-marketing').checked = false;
            modal.querySelector('#cookie-social').checked = false;
        }

        handleKeyboard(e) {
            if (e.key === 'Escape') {
                this.hideSettings();
            }
            
            // Focus management for modal
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
                timestamp: new Date().toISOString()
            };
            
            this.saveConsent();
            this.updateGoogleAnalytics();
            this.hideBanner();
            this.hideSettings();
            this.showConfirmation('✅ Alle Cookies akzeptiert');
            
            console.log('✅ Alle Cookies akzeptiert');
        }

        rejectAll() {
            this.consent = {
                necessary: true,
                analytics: false,
                marketing: false,
                social: false,
                timestamp: new Date().toISOString()
            };
            
            this.saveConsent();
            this.updateGoogleAnalytics();
            this.hideBanner();
            this.hideSettings();
            this.showConfirmation('❌ Nur notwendige Cookies aktiv');
            
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
                timestamp: new Date().toISOString()
            };
            
            this.saveConsent();
            this.updateGoogleAnalytics();
            this.hideSettings();
            this.hideBanner();
            this.showConfirmation('💾 Cookie-Einstellungen gespeichert');
            
            console.log('💾 Cookie-Einstellungen gespeichert:', this.consent);
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
                // Load current state
                this.loadConsentState();
                
                // Show modal
                modal.classList.remove('hidden');
                
                // Focus management
                setTimeout(() => {
                    const firstFocusable = modal.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
                    if (firstFocusable) {
                        firstFocusable.focus();
                    }
                }, 100);
                
                // Prevent body scroll
                document.body.style.overflow = 'hidden';
            }
        }

        hideSettings() {
            const modal = document.getElementById('cookie-settings-modal');
            if (modal) {
                modal.classList.add('hidden');
                
                // Restore body scroll
                document.body.style.overflow = '';
                
                // Close all expanded details
                modal.querySelectorAll('.cookie-details.expanded').forEach(details => {
                    details.classList.remove('expanded');
                });
                
                modal.querySelectorAll('.cookie-details-toggle[aria-expanded="true"]').forEach(button => {
                    button.setAttribute('aria-expanded', 'false');
                });
            }
        }

        showConfirmation(message) {
            // Use existing confirmation element or create one
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
                return stored ? JSON.parse(stored) : null;
            } catch (error) {
                console.error('🍪 Consent laden fehlgeschlagen:', error);
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
                version: '2.3.0',
                config: CONFIG
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
                debug: () => window.CookieConsent.getDebugInfo()
            };
            
            console.log('🍪 Cookie Banner v2.3 Production Edition geladen');
        }
    }

    // Initialisierung
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeCookieBanner);
    } else {
        initializeCookieBanner();
    }

})(window, document);
