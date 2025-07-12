// api-integration.js - RESTful API Integration with GraphQL Support
class APIManager {
    constructor() {
        this.config = {
            baseURL: 'https://api.abdulkerimsesli.de',
            timeout: 10000,
            retryAttempts: 3,
            retryDelay: 1000,
            apiVersion: 'v1',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        };
        
        this.cache = new Map();
        this.requestQueue = [];
        this.isOnline = navigator.onLine;
        this.rateLimiter = new Map();
        
        this.init();
    }

    init() {
        // Setup network status monitoring
        this.setupNetworkMonitoring();
        
        // Setup request interceptors
        this.setupInterceptors();
        
        // Setup cache management
        this.setupCacheManagement();
        
        // Setup rate limiting
        this.setupRateLimiting();
        
        console.log('🔌 API Manager initialized');
    }

    setupNetworkMonitoring() {
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.processOfflineQueue();
            console.log('📶 Network restored - processing queued requests');
        });

        window.addEventListener('offline', () => {
            this.isOnline = false;
            console.log('📵 Network offline - queueing requests');
        });
    }

    setupInterceptors() {
        // Request interceptor
        this.requestInterceptor = (config) => {
            // Add authentication if available
            const token = localStorage.getItem('authToken');
            if (token) {
                config.headers['Authorization'] = `Bearer ${token}`;
            }
            
            // Add request ID for tracking
            config.headers['X-Request-ID'] = this.generateRequestId();
            
            // Add user context
            config.headers['X-User-Agent'] = navigator.userAgent;
            config.headers['X-Timestamp'] = Date.now().toString();
            
            return config;
        };

        // Response interceptor
        this.responseInterceptor = (response) => {
            // Handle rate limiting
            if (response.status === 429) {
                const retryAfter = response.headers.get('Retry-After') || 60;
                this.handleRateLimit(retryAfter);
            }
            
            // Update cache if successful
            if (response.ok && response.config?.cache) {
                this.updateCache(response.config.cache.key, response.data);
            }
            
            return response;
        };
    }

    setupCacheManagement() {
        // Clean cache periodically
        setInterval(() => {
            this.cleanExpiredCache();
        }, 5 * 60 * 1000); // Every 5 minutes
    }

    setupRateLimiting() {
        // Reset rate limit counters hourly
        setInterval(() => {
            this.rateLimiter.clear();
        }, 60 * 60 * 1000); // Every hour
    }

    async request(endpoint, options = {}) {
        const config = this.prepareConfig(endpoint, options);
        
        // Check rate limiting
        if (this.isRateLimited(endpoint)) {
            throw new APIError('Rate limit exceeded', 429);
        }
        
        // Check cache first
        if (config.cache && config.method === 'GET') {
            const cached = this.getFromCache(config.cache.key);
            if (cached) {
                console.log(`💾 Cache hit: ${endpoint}`);
                return cached;
            }
        }
        
        // Check network status
        if (!this.isOnline && !config.offline) {
            return this.queueRequest(config);
        }
        
        try {
            const response = await this.executeRequest(config);
            this.updateRateLimit(endpoint);
            return response;
        } catch (error) {
            return this.handleRequestError(error, config);
        }
    }

    prepareConfig(endpoint, options) {
        const config = {
            url: this.buildURL(endpoint),
            method: options.method || 'GET',
            headers: { ...this.config.headers, ...options.headers },
            timeout: options.timeout || this.config.timeout,
            cache: options.cache,
            retry: options.retry !== false,
            offline: options.offline || false,
            ...options
        };
        
        // Apply request interceptor
        return this.requestInterceptor(config);
    }

    buildURL(endpoint) {
        const base = this.config.baseURL;
        const version = this.config.apiVersion;
        const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
        
        return `${base}/${version}/${cleanEndpoint}`;
    }

    async executeRequest(config) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), config.timeout);
        
        try {
            const response = await fetch(config.url, {
                method: config.method,
                headers: config.headers,
                body: config.body ? JSON.stringify(config.body) : undefined,
                signal: controller.signal,
                ...config.fetchOptions
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new APIError(
                    `HTTP ${response.status}: ${response.statusText}`,
                    response.status,
                    await response.text()
                );
            }
            
            const data = await response.json();
            const result = { data, status: response.status, headers: response.headers };
            
            // Apply response interceptor
            return this.responseInterceptor({ ...result, config });
            
        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    }

    async handleRequestError(error, config) {
        console.error(`❌ API Error for ${config.url}:`, error);
        
        // Retry logic
        if (config.retry && config.retryCount < this.config.retryAttempts) {
            const delay = this.calculateRetryDelay(config.retryCount);
            console.log(`🔄 Retrying in ${delay}ms (attempt ${config.retryCount + 1})`);
            
            await this.delay(delay);
            config.retryCount = (config.retryCount || 0) + 1;
            
            return this.executeRequest(config);
        }
        
        // If offline, queue the request
        if (!this.isOnline) {
            return this.queueRequest(config);
        }
        
        throw error;
    }

    queueRequest(config) {
        return new Promise((resolve, reject) => {
            this.requestQueue.push({ config, resolve, reject });
            console.log(`📤 Request queued: ${config.url}`);
        });
    }

    async processOfflineQueue() {
        const queue = [...this.requestQueue];
        this.requestQueue = [];
        
        for (const { config, resolve, reject } of queue) {
            try {
                const result = await this.executeRequest(config);
                resolve(result);
            } catch (error) {
                reject(error);
            }
        }
    }

    // REST API Methods
    async get(endpoint, params = {}, options = {}) {
        const url = this.addQueryParams(endpoint, params);
        return this.request(url, { ...options, method: 'GET' });
    }

    async post(endpoint, data, options = {}) {
        return this.request(endpoint, { 
            ...options, 
            method: 'POST', 
            body: data 
        });
    }

    async put(endpoint, data, options = {}) {
        return this.request(endpoint, { 
            ...options, 
            method: 'PUT', 
            body: data 
        });
    }

    async patch(endpoint, data, options = {}) {
        return this.request(endpoint, { 
            ...options, 
            method: 'PATCH', 
            body: data 
        });
    }

    async delete(endpoint, options = {}) {
        return this.request(endpoint, { ...options, method: 'DELETE' });
    }

    // GraphQL Support
    async graphql(query, variables = {}, options = {}) {
        const body = {
            query,
            variables
        };
        
        return this.post('graphql', body, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        });
    }

    // Batch Requests
    async batch(requests) {
        const batchBody = {
            requests: requests.map(req => ({
                id: this.generateRequestId(),
                method: req.method || 'GET',
                url: req.endpoint,
                body: req.body,
                headers: req.headers
            }))
        };
        
        return this.post('batch', batchBody);
    }

    // WebSocket Support
    connectWebSocket(endpoint, protocols = []) {
        const wsUrl = this.config.baseURL.replace('http', 'ws') + '/' + endpoint;
        const ws = new WebSocket(wsUrl, protocols);
        
        ws.addEventListener('open', () => {
            console.log(`🔌 WebSocket connected: ${endpoint}`);
        });
        
        ws.addEventListener('close', () => {
            console.log(`🔌 WebSocket disconnected: ${endpoint}`);
        });
        
        ws.addEventListener('error', (error) => {
            console.error(`❌ WebSocket error: ${endpoint}`, error);
        });
        
        return ws;
    }

    // Cache Management
    getFromCache(key) {
        const cached = this.cache.get(key);
        if (!cached) return null;
        
        if (Date.now() > cached.expiry) {
            this.cache.delete(key);
            return null;
        }
        
        return cached.data;
    }

    updateCache(key, data, ttl = 5 * 60 * 1000) { // 5 minutes default
        this.cache.set(key, {
            data,
            expiry: Date.now() + ttl,
            created: Date.now()
        });
    }

    clearCache(pattern = null) {
        if (pattern) {
            const regex = new RegExp(pattern);
            for (const [key] of this.cache) {
                if (regex.test(key)) {
                    this.cache.delete(key);
                }
            }
        } else {
            this.cache.clear();
        }
    }

    cleanExpiredCache() {
        const now = Date.now();
        for (const [key, cached] of this.cache) {
            if (now > cached.expiry) {
                this.cache.delete(key);
            }
        }
    }

    // Rate Limiting
    isRateLimited(endpoint) {
        const key = this.getRateLimitKey(endpoint);
        const limit = this.rateLimiter.get(key);
        
        if (!limit) return false;
        
        const maxRequests = 100; // Per hour
        return limit.count >= maxRequests;
    }

    updateRateLimit(endpoint) {
        const key = this.getRateLimitKey(endpoint);
        const now = Date.now();
        const limit = this.rateLimiter.get(key) || { count: 0, reset: now + 60 * 60 * 1000 };
        
        if (now > limit.reset) {
            limit.count = 1;
            limit.reset = now + 60 * 60 * 1000;
        } else {
            limit.count++;
        }
        
        this.rateLimiter.set(key, limit);
    }

    getRateLimitKey(endpoint) {
        return endpoint.split('?')[0]; // Remove query params
    }

    handleRateLimit(retryAfter) {
        console.warn(`⏱️ Rate limited. Retry after ${retryAfter} seconds`);
        
        // Could implement exponential backoff here
        setTimeout(() => {
            console.log('✅ Rate limit window reset');
        }, retryAfter * 1000);
    }

    // Utility Methods
    addQueryParams(url, params) {
        if (!params || Object.keys(params).length === 0) return url;
        
        const searchParams = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                searchParams.append(key, value.toString());
            }
        });
        
        const separator = url.includes('?') ? '&' : '?';
        return url + separator + searchParams.toString();
    }

    generateRequestId() {
        return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    calculateRetryDelay(attempt) {
        return this.config.retryDelay * Math.pow(2, attempt); // Exponential backoff
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Configuration
    setConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        console.log('⚙️ API configuration updated');
    }

    setAuthToken(token) {
        if (token) {
            localStorage.setItem('authToken', token);
            this.config.headers['Authorization'] = `Bearer ${token}`;
        } else {
            localStorage.removeItem('authToken');
            delete this.config.headers['Authorization'];
        }
    }

    // Health Check
    async healthCheck() {
        try {
            const response = await this.get('health', {}, { timeout: 5000 });
            console.log('💚 API health check passed');
            return response;
        } catch (error) {
            console.error('💔 API health check failed:', error);
            throw error;
        }
    }

    // Analytics
    getAnalytics() {
        return {
            cacheHitRate: this.calculateCacheHitRate(),
            queuedRequests: this.requestQueue.length,
            rateLimitStatus: this.getRateLimitStatus(),
            networkStatus: this.isOnline ? 'online' : 'offline'
        };
    }

    calculateCacheHitRate() {
        // This would require tracking hits/misses
        return 'Not implemented';
    }

    getRateLimitStatus() {
        const status = {};
        for (const [key, limit] of this.rateLimiter) {
            status[key] = {
                count: limit.count,
                remaining: Math.max(0, 100 - limit.count),
                resetTime: new Date(limit.reset)
            };
        }
        return status;
    }
}

// Custom Error Class
class APIError extends Error {
    constructor(message, status, response) {
        super(message);
        this.name = 'APIError';
        this.status = status;
        this.response = response;
    }
}

// Auto-initialize
if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', () => {
        window.apiManager = new APIManager();
        
        // Global API
        window.API = {
            get: (endpoint, params, options) => window.apiManager.get(endpoint, params, options),
            post: (endpoint, data, options) => window.apiManager.post(endpoint, data, options),
            put: (endpoint, data, options) => window.apiManager.put(endpoint, data, options),
            patch: (endpoint, data, options) => window.apiManager.patch(endpoint, data, options),
            delete: (endpoint, options) => window.apiManager.delete(endpoint, options),
            graphql: (query, variables, options) => window.apiManager.graphql(query, variables, options),
            batch: (requests) => window.apiManager.batch(requests),
            setAuth: (token) => window.apiManager.setAuthToken(token),
            health: () => window.apiManager.healthCheck(),
            config: (newConfig) => window.apiManager.setConfig(newConfig),
            analytics: () => window.apiManager.getAnalytics()
        };
        
        console.log('🚀 API integration ready');
    });
}

export default APIManager;
