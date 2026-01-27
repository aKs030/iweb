/**
 * Modern Fetch Utilities with Retry & Caching
 * @version 3.0.0
 */

import { createLogger } from './logger.js';
import { TimerManager } from './timer-utils.js';

const log = createLogger('Fetch');

/**
 * @typedef {Object} FetchConfig
 * @property {number} [timeout=8000] - Request timeout in ms
 * @property {number} [retries=3] - Number of retry attempts
 * @property {number} [retryDelay=1000] - Delay between retries in ms
 * @property {boolean} [cache=false] - Enable caching
 * @property {number} [cacheTTL=300000] - Cache TTL in ms (5 min default)
 * @property {RequestInit} [fetchOptions] - Native fetch options
 */

// Simple in-memory cache
const cache = new Map();

// Timer manager for cache cleanup
const timers = new TimerManager('FetchCache');

/**
 * Clear expired cache entries
 */
function clearExpiredCache() {
  const now = Date.now();
  for (const [key, value] of cache.entries()) {
    if (value.expires < now) {
      cache.delete(key);
    }
  }
}

// Clear cache every 5 minutes
if (typeof window !== 'undefined') {
  timers.setInterval(clearExpiredCache, 300000);
}

/**
 * Modern fetch with timeout, retry, and caching
 * @param {string} url - URL to fetch
 * @param {FetchConfig} [config] - Fetch configuration
 * @returns {Promise<Response>} Fetch response
 */
export async function fetchWithRetry(url, config = {}) {
  const {
    timeout = 8000,
    retries = 3,
    retryDelay = 1000,
    cache: useCache = false,
    cacheTTL = 300000,
    fetchOptions = {},
  } = config;

  // Check cache first
  if (useCache) {
    const cached = cache.get(url);
    if (cached && cached.expires > Date.now()) {
      log.debug(`Cache hit: ${url}`);
      return cached.response.clone();
    }
  }

  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
        credentials: fetchOptions.credentials || 'same-origin',
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Cache successful response
      if (useCache) {
        cache.set(url, {
          response: response.clone(),
          expires: Date.now() + cacheTTL,
        });
      }

      return response;
    } catch (error) {
      lastError = error;

      if (attempt < retries) {
        log.warn(`Fetch attempt ${attempt + 1} failed, retrying...`, error);
        await new Promise((resolve) =>
          setTimeout(resolve, retryDelay * (attempt + 1)),
        );
      }
    }
  }

  log.error(`Fetch failed after ${retries + 1} attempts:`, lastError);
  throw lastError;
}

/**
 * Fetch JSON with retry and caching
 * @param {string} url - URL to fetch
 * @param {FetchConfig} [config] - Fetch configuration
 * @returns {Promise<any>} Parsed JSON
 */
export async function fetchJSON(url, config = {}) {
  const response = await fetchWithRetry(url, { ...config, cache: true });
  return response.json();
}

/**
 * Fetch text with retry and caching
 * @param {string} url - URL to fetch
 * @param {FetchConfig} [config] - Fetch configuration
 * @returns {Promise<string>} Response text
 */
export async function fetchText(url, config = {}) {
  const response = await fetchWithRetry(url, config);
  return response.text();
}

/**
 * Fetch HTML with retry and caching
 * @param {string} url - URL to fetch
 * @param {FetchConfig} [config] - Fetch configuration
 * @returns {Promise<string>} HTML text
 */
export async function fetchHTML(url, config = {}) {
  return fetchText(url, { ...config, cache: true });
}

/**
 * Parallel fetch multiple URLs
 * @param {string[]} urls - URLs to fetch
 * @param {FetchConfig} [config] - Fetch configuration
 * @returns {Promise<Response[]>} Array of responses
 */
export async function fetchAll(urls, config = {}) {
  return Promise.all(urls.map((url) => fetchWithRetry(url, config)));
}

/**
 * Clear fetch cache
 * @param {string} [url] - Specific URL to clear, or all if omitted
 */
export function clearCache(url) {
  if (url) {
    cache.delete(url);
  } else {
    cache.clear();
  }
}

/**
 * Get cache statistics
 * @returns {{size: number, entries: Array<{url: string, expires: number}>}}
 */
export function getCacheStats() {
  return {
    size: cache.size,
    entries: Array.from(cache.entries()).map(([url, { expires }]) => ({
      url,
      expires: new Date(expires).toISOString(),
    })),
  };
}
