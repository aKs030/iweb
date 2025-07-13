/**
 * Main Initialization Script
 * Zentrale Koordination aller DOMContentLoaded Events
 * 
 * @author Optimization Team
 * @version 2.0.0
 * @date 2025-07-13
 */

class MainInitializer {
    constructor() {
        this.initModules = [];
        this.isInitialized = false;
        this.initStartTime = null;
        this.priorityModules = new Set(['ErrorHandler', 'PerformanceMonitor', 'SecurityManager']);
        this.moduleTimings = new Map();
        this.maxRetries = 3;
        this.retryDelays = [100, 500, 1000]; // Progressive retry delays
        
        // Performance monitoring integration
        this.recordInitMetric = this.recordInitMetric.bind(this);
        
        // Warte auf DOM
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initialize());
        } else {
            // DOM ist bereits geladen - verwende setTimeout für asynchrone Ausführung
            setTimeout(() => this.initialize(), 0);
        }
    }
    
    /**
     * Registriert ein Modul für die Initialisierung
     * @param {string} name - Name des Moduls
     * @param {Function} initFunction - Initialisierungsfunktion
     * @param {Object} options - Optionale Konfiguration
     */
    registerModule(name, initFunction, options = {}) {
        const moduleConfig = {
            name,
            initFunction,
            priority: this.priorityModules.has(name) ? 'high' : (options.priority || 'normal'),
            timeout: options.timeout || 5000,
            retryCount: 0,
            critical: options.critical || false,
            dependencies: options.dependencies || []
        };
        
        this.initModules.push(moduleConfig);
        
        // Sortiere Module nach Priorität
        this.sortModulesByPriority();
        
        // Wenn bereits initialisiert, sofort ausführen
        if (this.isInitialized) {
            this.runModuleWithRetry(moduleConfig);
        }
    }
    
    /**
     * Sortiert Module nach Priorität
     */
    sortModulesByPriority() {
        this.initModules.sort((a, b) => {
            const priorityOrder = { 'high': 0, 'normal': 1, 'low': 2 };
            return priorityOrder[a.priority] - priorityOrder[b.priority];
        });
    }
    
    /**
     * Führt ein einzelnes Modul mit Retry-Logik aus
     */
    async runModuleWithRetry(moduleConfig) {
        const startTime = performance.now();
        
        try {
            await this.runModule(moduleConfig.name, moduleConfig.initFunction, moduleConfig.timeout);
            
            // Erfolgreich initialisiert
            const duration = performance.now() - startTime;
            this.moduleTimings.set(moduleConfig.name, duration);
            this.recordInitMetric(moduleConfig.name, duration, 'success');
            
        } catch (error) {
            console.error(`❌ Fehler bei Initialisierung von ${moduleConfig.name}:`, error);
            
            // Retry-Logik für kritische Module
            if (moduleConfig.critical && moduleConfig.retryCount < this.maxRetries) {
                moduleConfig.retryCount++;
                const delay = this.retryDelays[moduleConfig.retryCount - 1] || 1000;
                
                console.warn(`🔄 Retry ${moduleConfig.retryCount}/${this.maxRetries} für ${moduleConfig.name} in ${delay}ms`);
                
                setTimeout(() => {
                    this.runModuleWithRetry(moduleConfig);
                }, delay);
                
                return;
            }
            
            // Fehler an Error Handler weiterleiten (falls verfügbar)
            if (window.websiteErrorHandler) {
                window.websiteErrorHandler.handleError({
                    type: 'initialization',
                    message: `Module ${moduleConfig.name} initialization failed`,
                    error: error.message,
                    retryCount: moduleConfig.retryCount,
                    timestamp: Date.now()
                });
            }
            
            const duration = performance.now() - startTime;
            this.recordInitMetric(moduleConfig.name, duration, 'failed');
        }
    }

    /**
     * Führt ein einzelnes Modul aus
     */
    async runModule(name, initFunction, timeout = 5000) {
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                reject(new Error(`Module ${name} initialization timeout (${timeout}ms)`));
            }, timeout);
            
            // Führe die Initialisierung aus
            Promise.resolve(initFunction())
                .then(() => {
                    clearTimeout(timeoutId);
                    console.log(`✅ ${name} initialisiert`);
                    resolve();
                })
                .catch((error) => {
                    clearTimeout(timeoutId);
                    reject(error);
                });
        });
    }
    
    /**
     * Prüft Abhängigkeiten eines Moduls
     */
    checkDependencies(moduleConfig) {
        if (!moduleConfig.dependencies.length) return true;
        
        return moduleConfig.dependencies.every(dep => 
            this.moduleTimings.has(dep) || window[dep]
        );
    }
    
    /**
     * Zeichnet Initialisierungs-Metriken auf
     */
    recordInitMetric(moduleName, duration, status) {
        if (window.websitePerformanceMonitor) {
            window.websitePerformanceMonitor.recordMetric('moduleInit', {
                module: moduleName,
                duration: duration,
                status: status,
                timestamp: Date.now()
            });
        }
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
        const results = {
            successful: [],
            failed: [],
            totalTime: 0
        };
        
        for (const moduleConfig of this.initModules) {
            // Prüfe Abhängigkeiten
            if (!this.checkDependencies(moduleConfig)) {
                console.warn(`⚠️ Abhängigkeiten für ${moduleConfig.name} nicht erfüllt, überspringe...`);
                results.failed.push(moduleConfig.name);
                continue;
            }
            
            try {
                await this.runModuleWithRetry(moduleConfig);
                results.successful.push(moduleConfig.name);
            } catch (error) {
                results.failed.push(moduleConfig.name);
                
                // Bei kritischen Modulen Warnung ausgeben
                if (moduleConfig.critical) {
                    console.error(`🚨 Kritisches Modul ${moduleConfig.name} konnte nicht initialisiert werden!`, error);
                }
                
                // Fehler weiterleiten aber Initialisierung fortsetzen
                if (window.websiteErrorHandler) {
                    window.websiteErrorHandler.handleError({
                        type: 'critical_initialization',
                        message: `Critical module ${moduleConfig.name} failed completely`,
                        error: error.message,
                        timestamp: Date.now()
                    });
                }
            }
        }
        
        const totalInitTime = performance.now() - this.initStartTime;
        results.totalTime = totalInitTime;
        
        // Dispatche Event für andere Scripts
        document.dispatchEvent(new CustomEvent('websiteInitialized', {
            detail: {
                timestamp: Date.now(),
                modules: results.successful,
                failed: results.failed,
                totalTime: totalInitTime,
                moduleTimings: Object.fromEntries(this.moduleTimings)
            }
        }));
        
        console.log(`✅ Website-Initialisierung abgeschlossen in ${Math.round(totalInitTime)}ms`);
        console.log(`📊 Erfolgreich: ${results.successful.length}, Fehlgeschlagen: ${results.failed.length}`);
        
        // Performance-Metrik aufzeichnen
        this.recordInitMetric('total', totalInitTime, 'completed');
    }
    /**
     * Gibt Initialisierungs-Statistiken zurück
     */
    getInitializationStats() {
        return {
            totalModules: this.initModules.length,
            successful: Array.from(this.moduleTimings.keys()),
            moduleTimings: Object.fromEntries(this.moduleTimings),
            isInitialized: this.isInitialized,
            totalInitTime: this.initStartTime ? performance.now() - this.initStartTime : 0
        };
    }
    
    /**
     * Cleanup-Funktion
     */
    cleanup() {
        this.initModules = [];
        this.moduleTimings.clear();
        this.isInitialized = false;
        this.initStartTime = null;
    }
}

// Globale Instanz erstellen
window.mainInitializer = new MainInitializer();

// Erweiterte Convenience-Funktion für andere Scripts
window.onWebsiteReady = (name, initFunction, options = {}) => {
    window.mainInitializer.registerModule(name, initFunction, options);
};

// Debug-Funktionen für Development
if (window.location.hostname === 'localhost') {
    window.debugInit = {
        stats: () => window.mainInitializer.getInitializationStats(),
        modules: () => window.mainInitializer.initModules,
        timings: () => Object.fromEntries(window.mainInitializer.moduleTimings),
        cleanup: () => window.mainInitializer.cleanup()
    };
    
    console.log('🔧 Debug functions: debugInit.stats(), debugInit.modules(), debugInit.timings()');
}
