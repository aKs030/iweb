// error-handler.js - Globale Fehlerbehandlung
class ErrorHandler {
    constructor() {
        this.errors = [];
        this.maxErrors = 50;
        this.init();
    }

    init() {
        // Globale JavaScript-Fehler abfangen
        window.addEventListener('error', (event) => {
            this.logError({
                type: 'javascript',
                message: event.message,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                error: event.error,
                timestamp: new Date().toISOString(),
                userAgent: navigator.userAgent,
                url: window.location.href
            });
        });

        // Promise-Rejections abfangen
        window.addEventListener('unhandledrejection', (event) => {
            this.logError({
                type: 'promise',
                message: event.reason?.message || 'Unhandled Promise Rejection',
                reason: event.reason,
                timestamp: new Date().toISOString(),
                userAgent: navigator.userAgent,
                url: window.location.href
            });
        });

        // Resource-Loading-Fehler
        window.addEventListener('error', (event) => {
            if (event.target !== window) {
                this.logError({
                    type: 'resource',
                    message: `Failed to load: ${event.target.tagName}`,
                    source: event.target.src || event.target.href,
                    timestamp: new Date().toISOString(),
                    userAgent: navigator.userAgent,
                    url: window.location.href
                });
            }
        }, true);

        // Console errors (optional)
        if (window.console && window.console.error) {
            const originalError = window.console.error;
            window.console.error = (...args) => {
                this.logError({
                    type: 'console',
                    message: args.join(' '),
                    timestamp: new Date().toISOString(),
                    userAgent: navigator.userAgent,
                    url: window.location.href
                });
                originalError.apply(console, args);
            };
        }
    }

    logError(errorInfo) {
        // Füge Fehler zur Liste hinzu
        this.errors.push(errorInfo);
        
        // Limitiere die Anzahl gespeicherter Fehler
        if (this.errors.length > this.maxErrors) {
            this.errors.shift();
        }

        // Debug-Ausgabe in Development
        if (this.isDevelopment()) {
            console.group('🚨 Error Logged');
            console.error('Type:', errorInfo.type);
            console.error('Message:', errorInfo.message);
            console.error('Details:', errorInfo);
            console.groupEnd();
        }

        // Sende kritische Fehler an Analytics (wenn verfügbar)
        this.sendToAnalytics(errorInfo);

        // Sende an externe Error-Tracking-Services (optional)
        this.sendToExternalService(errorInfo);
    }

    sendToAnalytics(errorInfo) {
        if (typeof window.gtag === 'function' && 
            window.CookieBanner?.hasConsent('analytics')) {
            
            window.gtag('event', 'exception', {
                description: `${errorInfo.type}: ${errorInfo.message}`,
                fatal: errorInfo.type === 'javascript',
                custom_map: {
                    error_type: errorInfo.type,
                    error_source: errorInfo.filename || errorInfo.source
                }
            });
        }
    }

    sendToExternalService(errorInfo) {
        // Beispiel für Sentry, LogRocket, oder andere Services
        if (window.Sentry && this.isCriticalError(errorInfo)) {
            window.Sentry.captureException(new Error(errorInfo.message), {
                tags: {
                    type: errorInfo.type,
                    component: 'iweb-6'
                },
                extra: errorInfo
            });
        }
    }

    isCriticalError(errorInfo) {
        const criticalPatterns = [
            /Cannot read prop/i,
            /TypeError/i,
            /ReferenceError/i,
            /network error/i,
            /failed to fetch/i
        ];

        return criticalPatterns.some(pattern => 
            pattern.test(errorInfo.message)
        );
    }

    isDevelopment() {
        return window.location.hostname === 'localhost' || 
               window.location.hostname === '127.0.0.1' ||
               window.location.search.includes('debug=true');
    }

    getErrors() {
        return this.errors;
    }

    clearErrors() {
        this.errors = [];
    }

    // Health Check für die Anwendung
    performHealthCheck() {
        const health = {
            timestamp: new Date().toISOString(),
            errors: this.errors.length,
            criticalErrors: this.errors.filter(e => this.isCriticalError(e)).length,
            performance: this.getPerformanceMetrics(),
            features: this.checkFeatureAvailability()
        };

        if (this.isDevelopment()) {
            console.table(health);
        }

        return health;
    }

    getPerformanceMetrics() {
        if (!window.performance) return null;

        const navigation = performance.getEntriesByType('navigation')[0];
        if (!navigation) return null;

        return {
            loadTime: Math.round(navigation.loadEventEnd - navigation.fetchStart),
            domReady: Math.round(navigation.domContentLoadedEventEnd - navigation.fetchStart),
            firstPaint: this.getFirstPaint()
        };
    }

    getFirstPaint() {
        const paintEntries = performance.getEntriesByType('paint');
        const firstPaint = paintEntries.find(entry => entry.name === 'first-paint');
        return firstPaint ? Math.round(firstPaint.startTime) : null;
    }

    checkFeatureAvailability() {
        return {
            serviceWorker: 'serviceWorker' in navigator,
            webgl: this.checkWebGL(),
            localStorage: this.checkLocalStorage(),
            cookies: navigator.cookieEnabled,
            geolocation: 'geolocation' in navigator,
            notifications: 'Notification' in window
        };
    }

    checkWebGL() {
        try {
            const canvas = document.createElement('canvas');
            return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
        } catch (e) {
            return false;
        }
    }

    checkLocalStorage() {
        try {
            const test = 'test';
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
            return true;
        } catch (e) {
            return false;
        }
    }
}

// Auto-initialisierung
if (typeof window !== 'undefined') {
    window.errorHandler = new ErrorHandler();
    
    // Globale API
    window.ErrorHandler = {
        getErrors: () => window.errorHandler.getErrors(),
        clearErrors: () => window.errorHandler.clearErrors(),
        healthCheck: () => window.errorHandler.performHealthCheck()
    };

    // Health Check alle 5 Minuten (nur in Development)
    if (window.errorHandler.isDevelopment()) {
        setInterval(() => {
            const health = window.errorHandler.performHealthCheck();
            if (health.criticalErrors > 0) {
                console.warn(`⚠️ ${health.criticalErrors} critical errors detected!`);
            }
        }, 5 * 60 * 1000);
    }
}

export default ErrorHandler;
