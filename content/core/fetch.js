/**
 * Modern Fetch Utilities with Retry & Caching
 * @version 3.1.0
 */

import { createLogger } from "./logger.js";
import { getCache } from "./cache.js";
import { sleep } from "./async-utils.js";

const log = createLogger("Fetch");

/**
 * @typedef {Object} FetchConfig
 * @property {number} [timeout=8000] - Request timeout in ms
 * @property {number} [retries=3] - Number of retry attempts
 * @property {number} [retryDelay=1000] - Delay between retries in ms
 * @property {boolean} [cache=false] - Enable caching
 * @property {number} [cacheTTL=300000] - Cache TTL in ms (5 min default)
 * @property {boolean} [throwOnHTTPError=true] - Throw when the final response is not ok
 * @property {RequestInit} [fetchOptions] - Native fetch options
 */

const cacheManager = getCache({ memorySize: 100 });

/** In-flight request deduplication map */
const _inflight = new Map();

/**
 * @param {RequestInit} fetchOptions
 * @returns {string}
 */
const getRequestMethod = (fetchOptions = {}) => String(fetchOptions?.method || "GET").toUpperCase();

/**
 * Create keys only for safe/idempotent requests with stable payload.
 * @param {string|URL} url
 * @param {RequestInit} fetchOptions
 * @returns {string|null}
 */
const getSafeRequestKey = (url, fetchOptions = {}) => {
  const method = getRequestMethod(fetchOptions);
  if (method !== "GET" && method !== "HEAD") return null;
  if ("body" in fetchOptions && fetchOptions.body != null) return null;
  return `${method}:${String(url)}`;
};

/**
 * @param {AbortSignal|undefined|null} externalSignal
 * @param {AbortSignal} timeoutSignal
 * @returns {{ signal: AbortSignal, cleanup: () => void }}
 */
const createCombinedSignal = (externalSignal, timeoutSignal) => {
  if (!externalSignal) {
    return { signal: timeoutSignal, cleanup: () => {} };
  }

  if (typeof AbortSignal !== "undefined" && "any" in AbortSignal) {
    return {
      signal: AbortSignal.any([externalSignal, timeoutSignal]),
      cleanup: () => {},
    };
  }

  const controller = new AbortController();
  const abort = () => controller.abort();

  if (externalSignal.aborted || timeoutSignal.aborted) {
    abort();
    return { signal: controller.signal, cleanup: () => {} };
  }

  externalSignal.addEventListener("abort", abort, { once: true });
  timeoutSignal.addEventListener("abort", abort, { once: true });

  return {
    signal: controller.signal,
    cleanup: () => {
      externalSignal.removeEventListener("abort", abort);
      timeoutSignal.removeEventListener("abort", abort);
    },
  };
};

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
    throwOnHTTPError = true,
    fetchOptions = {},
  } = config;
  const safeRequestKey = getSafeRequestKey(url, fetchOptions);
  const cacheKey = useCache && safeRequestKey ? safeRequestKey : null;

  if (cacheKey) {
    const cached = cacheManager.get(cacheKey);
    if (cached) {
      try {
        log.debug(`Cache hit: ${url}`);
        return cached.clone();
      } catch {
        cacheManager.delete(cacheKey);
      }
    }
  }

  // Request deduplication — reuse in-flight request for the same safe key
  if (safeRequestKey && _inflight.has(safeRequestKey)) {
    log.debug(`Dedup: reusing in-flight request for ${safeRequestKey}`);
    const response = await _inflight.get(safeRequestKey);
    return response.clone();
  }

  const executeRequest = async () => {
    let lastError;
    for (let attempt = 0; attempt <= retries; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      const { signal: externalSignal, ...requestOptions } = fetchOptions;
      const combinedSignal = createCombinedSignal(externalSignal, controller.signal);

      try {
        const response = await fetch(url, {
          ...requestOptions,
          signal: combinedSignal.signal,
          credentials: requestOptions.credentials || "same-origin",
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
          const isRetryableHTTP = response.status >= 500;

          if (!isRetryableHTTP || attempt >= retries) {
            if (throwOnHTTPError) throw error;
            return response;
          }

          lastError = error;
          log.warn(`Fetch attempt ${attempt + 1} failed, retrying...`, error);
          await sleep(retryDelay * Math.pow(2, attempt));
          continue;
        }

        if (cacheKey) {
          cacheManager.set(cacheKey, response.clone(), { ttl: cacheTTL });
        }
        return response;
      } catch (error) {
        clearTimeout(timeoutId);
        lastError = error;

        // Don't retry on abort or 4xx client errors
        const status = error.message?.match(/^HTTP (\d+)/)?.[1];
        if (
          error.name === "AbortError" ||
          (status && Number(status) >= 400 && Number(status) < 500)
        ) {
          break;
        }

        if (attempt < retries) {
          log.warn(`Fetch attempt ${attempt + 1} failed, retrying...`, error);
          await sleep(retryDelay * Math.pow(2, attempt));
        }
      } finally {
        combinedSignal.cleanup();
      }
    }

    log.error(`Fetch failed after ${retries + 1} attempts:`, lastError);
    throw lastError;
  };

  if (safeRequestKey) {
    const requestPromise = executeRequest();
    _inflight.set(safeRequestKey, requestPromise);
    try {
      return await requestPromise;
    } finally {
      _inflight.delete(safeRequestKey);
    }
  }

  return executeRequest();
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
