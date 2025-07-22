/**
 * Main Initialization Script - Optimized Version
 * Zentrale Koordination aller Module
 * 
 * @version 3.0.0 - Optimized
 * @date 2025-07-19
 */

class MainInitializer {
    constructor() {
        this.initModules = [];
        this.isInitialized = false;
        this.initStartTime = null;
        this.moduleTimings = new Map();
        
        // Prioritäts-Module für kritische Funktionen
        this.priorityModules = new Set(['ErrorHandler', 'PerformanceMonitor']);
        
        // Warte auf DOM
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initialize());
        } else {
            setTimeout(() => this.initialize(), 0);
        }
    }
    
    /**
     * Registriert ein Modul für die Initialisierung
     */
    registerModule(name, initFunction, options = {}) {
        const moduleConfig = {
            name,
            initFunction,
            priority: this.priorityModules.has(name) ? 'high' : (options.priority || 'normal'),
            timeout: options.timeout || 5000,
            critical: options.critical || false,
            dependencies: options.dependencies || []
        };
        
        this.initModules.push(moduleConfig);
        this.sortModulesByPriority();
        
        // Wenn bereits initialisiert, sofort ausführen
        if (this.isInitialized) {
            this.runModule(moduleConfig);
        }
    }
    
    /**
     * Sortiert Module nach Priorität
     */
    sortModulesByPriority() {
        const priorityOrder = { 'high': 0, 'normal': 1, 'low': 2 };
        this.initModules.sort((a, b) => 
            priorityOrder[a.priority] - priorityOrder[b.priority]
        );
    }
    
    /**
     * Führt ein einzelnes Modul aus
     */
    async runModule(moduleConfig) {
        const startTime = performance.now();
        
        try {
            // Prüfe Abhängigkeiten
            if (!this.checkDependencies(moduleConfig)) {
                console.warn(`⚠️ Abhängigkeiten für ${moduleConfig.name} nicht erfüllt`);
                return;
            }
            
            // Führe Modul mit Timeout aus
            await Promise.race([
                moduleConfig.initFunction(),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Timeout')), moduleConfig.timeout)
                )
            ]);
            
            const duration = performance.now() - startTime;
            this.moduleTimings.set(moduleConfig.name, duration);
            console.log(`✅ ${moduleConfig.name} initialisiert (${Math.round(duration)}ms)`);
            
        } catch (error) {
            console.error(`❌ Fehler in ${moduleConfig.name}:`, error);
            
            // Bei kritischen Modulen Warnung ausgeben
            if (moduleConfig.critical) {
                console.error(`🚨 Kritisches Modul ${moduleConfig.name} fehlgeschlagen!`);
            }
        }
    }
    
    /**
     * Prüft Abhängigkeiten eines Moduls
     */
    checkDependencies(moduleConfig) {
        return moduleConfig.dependencies.every(dep => 
            this.moduleTimings.has(dep) || window[dep]
        );
    }
    
    /**
     * Initialisiert alle registrierten Module
     */
    async initialize() {
        if (this.isInitialized) return;
        
        console.log('🚀 Starte Website-Initialisierung...');
        this.isInitialized = true;
        this.initStartTime = performance.now();
        
        // Führe Module in Prioritätsreihenfolge aus
        for (const moduleConfig of this.initModules) {
            await this.runModule(moduleConfig);
        }
        
        const totalTime = performance.now() - this.initStartTime;
        
        // Dispatche Event für andere Scripts
        document.dispatchEvent(new CustomEvent('websiteInitialized', {
            detail: {
                modules: Array.from(this.moduleTimings.keys()),
                totalTime: totalTime,
                moduleTimings: Object.fromEntries(this.moduleTimings)
            }
        }));
        
        console.log(`✅ Initialisierung abgeschlossen in ${Math.round(totalTime)}ms`);
    }
}

// Globale Instanz erstellen
window.mainInitializer = new MainInitializer();

// Convenience-Funktion für andere Scripts
window.onWebsiteReady = (name, initFunction, options = {}) => {
    window.mainInitializer.registerModule(name, initFunction, options);
};

// Share-Funktion global bereitstellen
// Importiere share-dialog.js, falls noch nicht geladen
if (typeof window.showShareDialog === 'undefined') {
    const script = document.createElement('script');
    script.src = '/assets/js/share-dialog.js';
    document.head.appendChild(script);
}

window.shareContent = async function(title, text, url) {
  if (navigator.share) {
    try {
      await navigator.share({ title, text, url });
    } catch (err) {
      // Nutzer hat das Teilen abgebrochen oder es ist ein Fehler aufgetreten
      console.log('Teilen abgebrochen oder Fehler:', err);
    }
  } else {
    // Fallback: Eigener Dialog oder Social Media Links anzeigen
    if (typeof window.showShareDialog === 'function') {
      window.showShareDialog(title, text, url);
      return;
    }
    alert('Teilen wird auf diesem Gerät nicht unterstützt.');
  }
};

// Registriere alle Module
window.onWebsiteReady('ErrorHandler', () => {
    // Error Handler ist bereits über enhanced-error-handler.js geladen
    return Promise.resolve();
}, { priority: 'high', critical: true });

window.onWebsiteReady('PerformanceMonitor', () => {
    // Performance Monitor ist bereits über performance-monitor-enhanced.js geladen
    return Promise.resolve();
}, { priority: 'high' });

window.onWebsiteReady('CookieSystem', async () => {
    // Cookie System wird über assets/js/cookie-system.js automatisch initialisiert
    return new Promise(resolve => {
        if (window.CookieConsent) {
            resolve();
        } else {
            document.addEventListener('DOMContentLoaded', resolve);
        }
    });
});

window.onWebsiteReady('Navigation', async () => {
    // Navigation wird über menu.js geladen
    return Promise.resolve();
});

window.onWebsiteReady('ScrollNavigation', async () => {
    // Scroll-Dots werden über scroll-dots.js geladen
    return Promise.resolve();
});

window.onWebsiteReady('ContentAnimation', async () => {
    // Content-Animationen werden über intext.js und templateLoader.js geladen
    return new Promise(resolve => {
        document.addEventListener('templatesLoaded', resolve);
    });
}, { dependencies: ['Navigation'] });

// Debug-Funktionen nur in Development
if (window.location.hostname === 'localhost') {
    window.debugInit = {
        stats: () => ({
            modules: Array.from(window.mainInitializer.moduleTimings.keys()),
            timings: Object.fromEntries(window.mainInitializer.moduleTimings),
            totalTime: window.mainInitializer.initStartTime ? 
                performance.now() - window.mainInitializer.initStartTime : 0
        }),
        reset: () => {
            window.mainInitializer.moduleTimings.clear();
            window.mainInitializer.isInitialized = false;
            console.log('🔄 Initialisierung zurückgesetzt');
        }
    };
}