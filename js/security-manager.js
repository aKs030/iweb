// security-manager.js - Advanced Security Management
class SecurityManager {
    constructor() {
        this.config = {
            csp: {
                enabled: true,
                reportOnly: false,
                directives: {
                    'default-src': ["'self'"],
                    'script-src': ["'self'", "'unsafe-inline'", 'https://www.googletagmanager.com', 'https://www.google-analytics.com'],
                    'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://cdn.jsdelivr.net'],
                    'font-src': ["'self'", 'https://fonts.gstatic.com', 'https://cdn.jsdelivr.net'],
                    'img-src': ["'self'", 'data:', 'https:', 'blob:'],
                    'connect-src': ["'self'", 'https://www.google-analytics.com'],
                    'frame-ancestors': ["'none'"],
                    'base-uri': ["'self'"],
                    'object-src': ["'none'"]
                }
            },
            monitoring: {
                enabled: true,
                reportEndpoint: '/security-report',
                logLevel: 'info'
            },
            validation: {
                enabled: true,
                sanitizeInputs: true,
                maxInputLength: 10000
            }
        };
        
        this.threats = [];
        this.violations = [];
        this.init();
    }

    init() {
        // Setup Content Security Policy
        this.setupCSP();
        
        // Input validation and sanitization
        this.setupInputValidation();
        
        // XSS Protection
        this.setupXSSProtection();
        
        // Clickjacking protection
        this.setupClickjackingProtection();
        
        // Secure Headers
        this.enforceSecureHeaders();
        
        // Monitor security events
        this.setupSecurityMonitoring();
        
        // Periodic security checks
        this.scheduleSecurityChecks();
    }

    setupCSP() {
        if (!this.config.csp.enabled) return;

        // Generate CSP header string
        const cspString = Object.entries(this.config.csp.directives)
            .map(([directive, sources]) => `${directive} ${sources.join(' ')}`)
            .join('; ');

        // Set CSP via meta tag (for client-side enforcement)
        const existingCSP = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
        if (!existingCSP) {
            const cspMeta = document.createElement('meta');
            cspMeta.httpEquiv = 'Content-Security-Policy';
            cspMeta.content = cspString;
            document.head.appendChild(cspMeta);
        }

        // CSP Violation Reporting
        document.addEventListener('securitypolicyviolation', (e) => {
            this.handleCSPViolation(e);
        });

        this.log('CSP configured and enforced', 'info');
    }

    setupInputValidation() {
        if (!this.config.validation.enabled) return;

        // Monitor all form inputs
        document.addEventListener('input', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                this.validateInput(e.target);
            }
        });

        // Monitor form submissions
        document.addEventListener('submit', (e) => {
            if (!this.validateForm(e.target)) {
                e.preventDefault();
                this.logThreat('Invalid form submission blocked', e.target);
            }
        });

        this.log('Input validation configured', 'info');
    }

    setupXSSProtection() {
        // Monitor for potentially malicious script injection
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            this.scanElementForXSS(node);
                        }
                    });
                }
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        // Override potentially dangerous methods
        this.overrideDangerousMethods();

        this.log('XSS protection activated', 'info');
    }

    setupClickjackingProtection() {
        // Check if page is in iframe
        if (window.top !== window.self) {
            // Verify if iframe is from same origin
            try {
                const parentOrigin = window.parent.location.origin;
                const currentOrigin = window.location.origin;
                
                if (parentOrigin !== currentOrigin) {
                    this.logThreat('Potential clickjacking attempt detected', {
                        parentOrigin,
                        currentOrigin,
                        referrer: document.referrer
                    });
                    
                    // Optionally break out of iframe
                    if (this.config.monitoring.breakFrames) {
                        window.top.location = window.location;
                    }
                }
            } catch (e) {
                // Cross-origin iframe detected
                this.logThreat('Cross-origin iframe detected', {
                    referrer: document.referrer,
                    error: e.message
                });
            }
        }
    }

    enforceSecureHeaders() {
        // Check for secure headers that should be set by server
        const requiredHeaders = [
            'X-Content-Type-Options',
            'X-Frame-Options',
            'X-XSS-Protection',
            'Strict-Transport-Security'
        ];

        // This would typically be done server-side
        // Here we just check if they're present
        fetch(window.location.href, { method: 'HEAD' })
            .then(response => {
                requiredHeaders.forEach(header => {
                    if (!response.headers.get(header)) {
                        this.log(`Missing security header: ${header}`, 'warning');
                    }
                });
            })
            .catch(() => {
                // Silently fail - we can't check headers in this way due to CORS
            });
    }

    setupSecurityMonitoring() {
        // Monitor console for security-related messages
        const originalConsoleError = console.error;
        console.error = (...args) => {
            const message = args.join(' ');
            if (this.isSecurityRelated(message)) {
                this.logThreat('Security-related console error', { message, args });
            }
            originalConsoleError.apply(console, args);
        };

        // Monitor network requests
        this.monitorNetworkRequests();

        // Monitor localStorage/sessionStorage access
        this.monitorStorageAccess();

        this.log('Security monitoring activated', 'info');
    }

    validateInput(input) {
        const value = input.value;
        const threats = [];

        // Check length
        if (value.length > this.config.validation.maxInputLength) {
            threats.push('Input too long');
            input.value = value.substring(0, this.config.validation.maxInputLength);
        }

        // Check for XSS patterns
        const xssPatterns = [
            /<script[^>]*>.*?<\/script>/gi,
            /javascript:/gi,
            /on\w+\s*=/gi,
            /<iframe[^>]*>.*?<\/iframe>/gi,
            /<object[^>]*>.*?<\/object>/gi,
            /<embed[^>]*>/gi
        ];

        xssPatterns.forEach(pattern => {
            if (pattern.test(value)) {
                threats.push('Potential XSS pattern detected');
                if (this.config.validation.sanitizeInputs) {
                    input.value = value.replace(pattern, '');
                }
            }
        });

        // Check for SQL injection patterns
        const sqlPatterns = [
            /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/gi,
            /(\b(OR|AND)\s+\d+\s*=\s*\d+)/gi,
            /(--|\/\*|\*\/)/g
        ];

        sqlPatterns.forEach(pattern => {
            if (pattern.test(value)) {
                threats.push('Potential SQL injection pattern detected');
            }
        });

        if (threats.length > 0) {
            this.logThreat('Input validation threats detected', {
                input: input.name || input.id,
                threats,
                value: value.substring(0, 100) // Log only first 100 chars
            });
        }

        return threats.length === 0;
    }

    validateForm(form) {
        let isValid = true;
        const inputs = form.querySelectorAll('input, textarea, select');
        
        inputs.forEach(input => {
            if (!this.validateInput(input)) {
                isValid = false;
            }
        });

        return isValid;
    }

    scanElementForXSS(element) {
        // Check for dangerous attributes
        const dangerousAttributes = ['onclick', 'onload', 'onerror', 'onmouseover'];
        dangerousAttributes.forEach(attr => {
            if (element.hasAttribute(attr)) {
                this.logThreat('Dangerous attribute detected', {
                    element: element.tagName,
                    attribute: attr,
                    value: element.getAttribute(attr)
                });
            }
        });

        // Check for script tags
        if (element.tagName === 'SCRIPT') {
            const src = element.src;
            const content = element.textContent;
            
            if (src && !this.isAllowedScriptSource(src)) {
                this.logThreat('Unauthorized script source', { src });
                element.remove();
            }
            
            if (content && this.containsMaliciousCode(content)) {
                this.logThreat('Potentially malicious script content detected', {
                    content: content.substring(0, 200)
                });
            }
        }
    }

    overrideDangerousMethods() {
        // Override eval
        const originalEval = window.eval;
        window.eval = (code) => {
            this.logThreat('eval() usage detected', { code: code.substring(0, 100) });
            if (this.config.monitoring.blockEval) {
                throw new Error('eval() usage is blocked for security reasons');
            }
            return originalEval(code);
        };

        // Override Function constructor
        const originalFunction = window.Function;
        window.Function = function(...args) {
            const code = args[args.length - 1];
            this.logThreat('Function constructor usage detected', { code: code.substring(0, 100) });
            return originalFunction.apply(this, args);
        }.bind(this);
    }

    monitorNetworkRequests() {
        // Override fetch
        const originalFetch = window.fetch;
        window.fetch = async (url, options = {}) => {
            const requestUrl = url.toString();
            
            // Check for suspicious URLs
            if (this.isSuspiciousUrl(requestUrl)) {
                this.logThreat('Suspicious network request blocked', { url: requestUrl });
                throw new Error('Request blocked for security reasons');
            }
            
            // Log external requests
            if (!requestUrl.startsWith(window.location.origin)) {
                this.log(`External request: ${requestUrl}`, 'info');
            }
            
            return originalFetch(url, options);
        };

        // Override XMLHttpRequest
        const originalXHROpen = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function(method, url, ...args) {
            if (this.isSuspiciousUrl(url)) {
                this.logThreat('Suspicious XHR request blocked', { url });
                throw new Error('Request blocked for security reasons');
            }
            return originalXHROpen.call(this, method, url, ...args);
        }.bind(this);
    }

    monitorStorageAccess() {
        const storageTypes = ['localStorage', 'sessionStorage'];
        
        storageTypes.forEach(storageType => {
            const originalSetItem = window[storageType].setItem;
            const originalGetItem = window[storageType].getItem;
            
            window[storageType].setItem = (key, value) => {
                // Check for sensitive data being stored
                if (this.containsSensitiveData(key, value)) {
                    this.logThreat('Sensitive data storage detected', {
                        storageType,
                        key,
                        hasValue: !!value
                    });
                }
                return originalSetItem.call(window[storageType], key, value);
            };
            
            window[storageType].getItem = (key) => {
                // Log access to sensitive keys
                if (this.isSensitiveKey(key)) {
                    this.log(`Sensitive storage access: ${key}`, 'info');
                }
                return originalGetItem.call(window[storageType], key);
            };
        });
    }

    scheduleSecurityChecks() {
        // Run security audit every 5 minutes
        setInterval(() => {
            this.runSecurityAudit();
        }, 5 * 60 * 1000);

        // Run integrity check every minute
        setInterval(() => {
            this.checkIntegrity();
        }, 60 * 1000);
    }

    runSecurityAudit() {
        const audit = {
            timestamp: Date.now(),
            threatsDetected: this.threats.length,
            violationsDetected: this.violations.length,
            checks: {
                csp: this.checkCSPCompliance(),
                https: window.location.protocol === 'https:',
                mixedContent: this.checkMixedContent(),
                suspiciousScripts: this.checkSuspiciousScripts(),
                storageUsage: this.checkStorageUsage()
            }
        };

        this.log('Security audit completed', 'info', audit);
        return audit;
    }

    checkIntegrity() {
        // Check if critical security elements have been tampered with
        const cspMeta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
        if (!cspMeta && this.config.csp.enabled) {
            this.logThreat('CSP meta tag removed - potential tampering detected');
        }

        // Check for unexpected script tags
        const scripts = document.querySelectorAll('script[src]');
        scripts.forEach(script => {
            if (!this.isAllowedScriptSource(script.src)) {
                this.logThreat('Unauthorized script detected during integrity check', {
                    src: script.src
                });
            }
        });
    }

    // Utility methods
    isSecurityRelated(message) {
        const securityKeywords = [
            'xss', 'injection', 'csrf', 'clickjacking', 'malicious',
            'unauthorized', 'security', 'violation', 'blocked'
        ];
        return securityKeywords.some(keyword => 
            message.toLowerCase().includes(keyword)
        );
    }

    isAllowedScriptSource(src) {
        const allowedDomains = [
            window.location.origin,
            'https://www.googletagmanager.com',
            'https://www.google-analytics.com',
            'https://cdn.jsdelivr.net'
        ];
        
        return allowedDomains.some(domain => src.startsWith(domain));
    }

    containsMaliciousCode(code) {
        const maliciousPatterns = [
            /document\.write/gi,
            /eval\s*\(/gi,
            /innerHTML\s*=/gi,
            /outerHTML\s*=/gi,
            /location\s*=/gi,
            /window\.open/gi
        ];
        
        return maliciousPatterns.some(pattern => pattern.test(code));
    }

    isSuspiciousUrl(url) {
        const suspiciousPatterns = [
            /javascript:/gi,
            /data:text\/html/gi,
            /vbscript:/gi,
            /\.onion\//gi
        ];
        
        return suspiciousPatterns.some(pattern => pattern.test(url));
    }

    containsSensitiveData(key, value) {
        const sensitivePatterns = [
            /password/gi,
            /token/gi,
            /secret/gi,
            /key/gi,
            /credit.*card/gi,
            /ssn/gi
        ];
        
        const data = `${key} ${value}`;
        return sensitivePatterns.some(pattern => pattern.test(data));
    }

    isSensitiveKey(key) {
        const sensitiveKeys = [
            'authToken', 'sessionId', 'password', 'secret',
            'creditCard', 'ssn', 'privateKey'
        ];
        
        return sensitiveKeys.some(sensitiveKey => 
            key.toLowerCase().includes(sensitiveKey.toLowerCase())
        );
    }

    checkCSPCompliance() {
        const cspMeta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
        return !!cspMeta;
    }

    checkMixedContent() {
        if (window.location.protocol === 'https:') {
            const insecureElements = document.querySelectorAll(
                'img[src^="http:"], script[src^="http:"], link[href^="http:"]'
            );
            return insecureElements.length === 0;
        }
        return true;
    }

    checkSuspiciousScripts() {
        const scripts = document.querySelectorAll('script');
        let suspiciousCount = 0;
        
        scripts.forEach(script => {
            if (script.src && !this.isAllowedScriptSource(script.src)) {
                suspiciousCount++;
            }
            if (script.textContent && this.containsMaliciousCode(script.textContent)) {
                suspiciousCount++;
            }
        });
        
        return suspiciousCount === 0;
    }

    checkStorageUsage() {
        const localStorageSize = JSON.stringify(localStorage).length;
        const sessionStorageSize = JSON.stringify(sessionStorage).length;
        
        return {
            localStorage: localStorageSize,
            sessionStorage: sessionStorageSize,
            total: localStorageSize + sessionStorageSize
        };
    }

    handleCSPViolation(event) {
        const violation = {
            timestamp: Date.now(),
            blockedURI: event.blockedURI,
            documentURI: event.documentURI,
            effectiveDirective: event.effectiveDirective,
            originalPolicy: event.originalPolicy,
            referrer: event.referrer,
            statusCode: event.statusCode,
            violatedDirective: event.violatedDirective
        };
        
        this.violations.push(violation);
        this.logThreat('CSP violation detected', violation);
    }

    logThreat(message, data = {}) {
        const threat = {
            timestamp: Date.now(),
            message,
            data,
            url: window.location.href,
            userAgent: navigator.userAgent
        };
        
        this.threats.push(threat);
        
        if (this.config.monitoring.logLevel === 'debug' || 
            window.location.hostname === 'localhost') {
            console.warn('🚨 Security Threat:', threat);
        }
        
        // Send to monitoring endpoint
        this.reportThreat(threat);
    }

    log(message, level = 'info', data = {}) {
        if (this.config.monitoring.logLevel === 'debug' || 
            window.location.hostname === 'localhost') {
            console.log(`🔒 Security: ${message}`, data);
        }
    }

    async reportThreat(threat) {
        if (!this.config.monitoring.enabled) return;
        
        try {
            // In production, send to security monitoring endpoint
            if (window.gtag) {
                gtag('event', 'security_threat', {
                    event_category: 'Security',
                    event_label: threat.message,
                    custom_parameter_1: threat.data
                });
            }
            
            // Custom event for other scripts
            window.dispatchEvent(new CustomEvent('securityThreat', {
                detail: threat
            }));
            
        } catch (error) {
            console.warn('Failed to report security threat:', error);
        }
    }

    // Public API
    getThreats() {
        return [...this.threats];
    }

    getViolations() {
        return [...this.violations];
    }

    getSecurityReport() {
        return {
            threats: this.threats.length,
            violations: this.violations.length,
            lastAudit: this.runSecurityAudit(),
            config: this.config
        };
    }

    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        this.log('Security configuration updated', 'info');
    }
}

// Auto-initialize
if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', () => {
        window.securityManager = new SecurityManager();
        
        // Global API
        window.Security = {
            getThreats: () => window.securityManager.getThreats(),
            getViolations: () => window.securityManager.getViolations(),
            getReport: () => window.securityManager.getSecurityReport(),
            updateConfig: (config) => window.securityManager.updateConfig(config)
        };
    });
}

export default SecurityManager;
