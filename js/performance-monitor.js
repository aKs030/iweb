// performance-monitor.js - Advanced Performance Monitoring
class AdvancedPerformanceMonitor {
    constructor() {
        this.metrics = {
            navigation: {},
            resources: [],
            vitals: {},
            custom: {},
            errors: []
        };
        this.observers = new Map();
        this.thresholds = {
            fcp: 1800,  // First Contentful Paint
            lcp: 2500,  // Largest Contentful Paint
            fid: 100,   // First Input Delay
            cls: 0.1,   // Cumulative Layout Shift
            ttfb: 800   // Time to First Byte
        };
        this.initialized = false;
        this.setupMonitoring();
    }

    setupMonitoring() {
        if (this.initialized) return;
        
        // Wait for page load
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initializeMonitoring());
        } else {
            this.initializeMonitoring();
        }
    }

    initializeMonitoring() {
        this.initialized = true;
        
        // Core Web Vitals
        this.measureCoreWebVitals();
        
        // Navigation Timing
        this.measureNavigationTiming();
        
        // Resource Timing
        this.measureResourceTiming();
        
        // Long Tasks
        this.observeLongTasks();
        
        // Layout Shifts
        this.observeLayoutShifts();
        
        // Memory Usage
        this.measureMemoryUsage();
        
        // Network Information
        this.getNetworkInfo();
        
        // User Interactions
        this.trackUserInteractions();
        
        // Send initial report
        setTimeout(() => this.sendReport(), 5000);
        
        // Periodic reporting
        setInterval(() => this.sendReport(), 30000);
    }

    observeMetrics() {
        // Largest Contentful Paint
        const lcpObserver = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            const lastEntry = entries[entries.length - 1];
            this.metrics.lcp = lastEntry.startTime;
            console.log('LCP:', lastEntry.startTime);
        });
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

        // First Input Delay
        const fidObserver = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            entries.forEach((entry) => {
                this.metrics.fid = entry.processingStart - entry.startTime;
                console.log('FID:', entry.processingStart - entry.startTime);
            });
        });
        fidObserver.observe({ entryTypes: ['first-input'] });

        // Cumulative Layout Shift
        const clsObserver = new PerformanceObserver((list) => {
            let clsValue = 0;
            const entries = list.getEntries();
            entries.forEach((entry) => {
                if (!entry.hadRecentInput) {
                    clsValue += entry.value;
                }
            });
            this.metrics.cls = clsValue;
            console.log('CLS:', clsValue);
        });
        clsObserver.observe({ entryTypes: ['layout-shift'] });
    }

    measureCoreWebVitals() {
        // Modern Navigation Timing API
        if ('performance' in window && 'getEntriesByType' in window.performance) {
            window.addEventListener('load', () => {
                const navigationEntries = performance.getEntriesByType('navigation');
                if (navigationEntries.length > 0) {
                    const timing = navigationEntries[0];
                    this.metrics.ttfb = timing.responseStart - timing.requestStart;
                    this.metrics.domContentLoaded = timing.domContentLoadedEventEnd - timing.fetchStart;
                    this.metrics.windowLoad = timing.loadEventEnd - timing.fetchStart;
                    
                    console.log('TTFB:', this.metrics.ttfb);
                    console.log('DOM Content Loaded:', this.metrics.domContentLoaded);
                    console.log('Window Load:', this.metrics.windowLoad);
                }
            });
        }
    }

    measurePageLoad() {
        const startTime = performance.now();
        
        document.addEventListener('DOMContentLoaded', () => {
            this.metrics.domReady = performance.now() - startTime;
            console.log('DOM Ready:', this.metrics.domReady);
        });

        window.addEventListener('load', () => {
            this.metrics.pageLoad = performance.now() - startTime;
            console.log('Page Load:', this.metrics.pageLoad);
            
            // Send metrics to analytics if available
            this.sendMetrics();
        });
    }

    sendMetrics() {
        if (typeof window.gtag === 'function' && window.CookieBanner?.hasConsent('analytics')) {
            // Send custom metrics to Google Analytics
            Object.keys(this.metrics).forEach(metric => {
                window.gtag('event', 'performance_metric', {
                    event_category: 'Performance',
                    event_label: metric,
                    value: Math.round(this.metrics[metric])
                });
            });
        }
    }

    getMetrics() {
        return this.metrics;
    }
}

// Auto-initialize if not in debug mode
if (!window.location.search.includes('no-perf')) {
    window.performanceMonitor = new PerformanceMonitor();
}

export default PerformanceMonitor;
