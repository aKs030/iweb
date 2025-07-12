/**
 * Cookie Banner Loader - Universal Cookie Banner Component
 * Lädt das Cookie-Banner-Snippet für alle Seiten
 * Version: 2.0
 * Author: Abdulkerim
 */

class CookieBannerLoader {
    constructor() {
        this.initialized = false;
        this.bannerLoaded = false;
        this.cssLoaded = false;
        this.cookieScriptLoaded = false;
    }

    /**
     * Initialisiert das Cookie-Banner
     * @param {Object} options - Konfigurationsoptionen
     */
    async init(options = {}) {
        if (this.initialized) return;
        
        try {
            // Standard-Konfiguration
            const config = {
                cssPath: '/css/cookies.css',
                bannerPath: '/pages/komponente/cookie-banner.html',
                cookieScriptPath: '/js/cookies.js',
                insertTarget: 'body',
                insertPosition: 'beforeend',
                preloadCSS: true,
                ...options
            };

            // CSS vorladen (für bessere Performance)
            if (config.preloadCSS) {
                await this.loadCSS(config.cssPath);
            }

            // Cookie-Banner HTML laden
            await this.loadBannerHTML(config.bannerPath, config.insertTarget, config.insertPosition);

            // Cookie-Script laden
            await this.loadCookieScript(config.cookieScriptPath);

            this.initialized = true;
            console.log('🍪 Cookie-Banner erfolgreich initialisiert');
            
            // Event für erfolgreiche Initialisierung
            document.dispatchEvent(new CustomEvent('cookieBannerLoaded', {
                detail: { config }
            }));

        } catch (error) {
            console.error('❌ Fehler beim Initialisieren des Cookie-Banners:', error);
            throw error;
        }
    }

    /**
     * Lädt die CSS-Datei für das Cookie-Banner
     * @param {string} cssPath - Pfad zur CSS-Datei
     */
    async loadCSS(cssPath) {
        if (this.cssLoaded) return;

        return new Promise((resolve, reject) => {
            // Prüfen ob CSS bereits geladen
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

    /**
     * Lädt das Cookie-Banner HTML
     * @param {string} bannerPath - Pfad zum Banner HTML
     * @param {string} insertTarget - Ziel-Element für das Einfügen
     * @param {string} insertPosition - Position des Einfügens
     */
    async loadBannerHTML(bannerPath, insertTarget, insertPosition) {
        if (this.bannerLoaded) return;

        try {
            const response = await fetch(bannerPath);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const bannerHTML = await response.text();
            const targetElement = document.querySelector(insertTarget) || document.body;
            
            // HTML einfügen
            targetElement.insertAdjacentHTML(insertPosition, bannerHTML);
            
            this.bannerLoaded = true;
            console.log('✅ Cookie-Banner HTML geladen');

        } catch (error) {
            throw new Error(`Banner HTML konnte nicht geladen werden: ${error.message}`);
        }
    }

    /**
     * Lädt das Cookie-Script
     * @param {string} scriptPath - Pfad zum Cookie-Script
     */
    async loadCookieScript(scriptPath) {
        if (this.cookieScriptLoaded) return;

        return new Promise((resolve, reject) => {
            // Prüfen ob Script bereits geladen
            const existingScript = document.querySelector(`script[src="${scriptPath}"]`);
            if (existingScript) {
                this.cookieScriptLoaded = true;
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = scriptPath;
            script.defer = true;
            
            script.onload = () => {
                this.cookieScriptLoaded = true;
                console.log('✅ Cookie-Script geladen');
                
                // Event für Cookie-Script-Laden senden
                document.dispatchEvent(new CustomEvent('cookieScriptLoaded'));
                resolve();
            };
            
            script.onerror = () => {
                reject(new Error(`Script konnte nicht geladen werden: ${scriptPath}`));
            };

            document.head.appendChild(script);
        });
    }

    /**
     * Prüft ob das Cookie-Banner geladen ist
     */
    isLoaded() {
        return this.bannerLoaded && this.cssLoaded && this.cookieScriptLoaded;
    }

    /**
     * Entfernt das Cookie-Banner (für Debugging)
     */
    remove() {
        const banner = document.getElementById('cookie-banner');
        const modal = document.getElementById('cookie-settings-modal');
        const confirmation = document.getElementById('cookie-confirmation');
        const fab = document.getElementById('cookie-fab');
        const scanner = document.getElementById('cookie-scanner-status');

        [banner, modal, confirmation, fab, scanner].forEach(element => {
            if (element) element.remove();
        });

        this.bannerLoaded = false;
        this.initialized = false;
        console.log('🗑️ Cookie-Banner entfernt');
    }
}

// Globale Instanz erstellen
window.CookieBannerLoader = CookieBannerLoader;

// Auto-Initialisierung wenn DOM geladen ist
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', async () => {
        const loader = new CookieBannerLoader();
        try {
            await loader.init();
        } catch (error) {
            console.warn('Cookie-Banner konnte nicht automatisch geladen werden:', error);
        }
    });
} else {
    // DOM bereits geladen
    const loader = new CookieBannerLoader();
    loader.init().catch(error => {
        console.warn('Cookie-Banner konnte nicht automatisch geladen werden:', error);
    });
}
