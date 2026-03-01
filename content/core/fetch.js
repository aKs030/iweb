/**
 * Modern Fetch Utilities with Retry & Caching
 * @version 3.1.0
 */

import { createLogger } from './logger.js';
import { getCache } from './cache.js';
import { sleep } from './utils.js';

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

// Use unified CacheManager instead of simple Map
const cacheManager = getCache({ memorySize: 100 });

/** In-flight request deduplication map */
const _inflight = new Map();

/**
 * Modern fetch with timeout, retry, and caching
 * @param {string} url - URL to fetch
 * @param {FetchConfig} [config] - Fetch configuration
 * @returns {Promise<Response>} Fetch response
 */
async function fetchWithRetry(url, config = {}) {
  const {
    timeout = 8000,
    retries = 3,
    retryDelay = 1000,
    cache: useCache = false,
    cacheTTL = 300000,
    fetchOptions = {},
  } = config;

  // Check cache first using CacheManager
  if (useCache) {
    const cached = await cacheManager.get(url);
    if (cached) {
      try {
        log.debug(`Cache hit: ${url}`);
        return cached.clone();
      } catch {
        // Cache entry invalid (body already consumed), remove it
        await cacheManager.delete(url);
      }
    }
  }

  // Request deduplication — reuse in-flight request for the same URL
  if (_inflight.has(url)) {
    log.debug(`Dedup: reusing in-flight request for ${url}`);
    const response = await _inflight.get(url);
    return response.clone();
  }

  let lastError;
  let resolveInflight;
  const inflightPromise = new Promise((r) => {
    resolveInflight = r;
  });
  _inflight.set(url, inflightPromise);

  try {
    for (let attempt = 0; attempt <= retries; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await fetch(url, {
          ...fetchOptions,
          signal: controller.signal,
          credentials: fetchOptions.credentials || 'same-origin',
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        // Cache successful response using CacheManager
        if (useCache) {
          await cacheManager.set(url, response.clone(), { ttl: cacheTTL });
        }

        resolveInflight(response.clone());
        return response;
      } catch (error) {
        clearTimeout(timeoutId);
        lastError = error;

        // Don't retry on abort or 4xx client errors
        const status = error.message?.match(/^HTTP (\d+)/)?.[1];
        if (
          error.name === 'AbortError' ||
          (status && Number(status) >= 400 && Number(status) < 500)
        ) {
          break;
        }

        if (attempt < retries) {
          log.warn(`Fetch attempt ${attempt + 1} failed, retrying...`, error);
          await sleep(retryDelay * Math.pow(2, attempt));
        }
      }
    }

    log.error(`Fetch failed after ${retries + 1} attempts:`, lastError);
    throw lastError;
  } finally {
    _inflight.delete(url);
  }
}

/**
 * Fetch JSON with retry and caching
 * @param {string} url - URL to fetch
 * @param {FetchConfig} [config] - Fetch configuration
 * @returns {Promise<any>} Parsed JSON
 */
export async function fetchJSON(url, config = {}) {
  const response = await fetchWithRetry(url, { cache: true, ...config });
  try {
    return await response.json();
  } catch (err) {
    log.error(`Invalid JSON from ${url}:`, err);
    throw new Error(`Invalid JSON response from ${url}`, { cause: err });
  }
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
