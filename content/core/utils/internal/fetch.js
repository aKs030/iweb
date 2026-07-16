import { createLogger } from "../../logger.js";
import { sleep } from "./async.js";

const log = createLogger("Fetch");
const inflightRequests = new Map();

class ResponseCache {
  constructor(maxSize = 100) {
    this.items = new Map();
    this.maxSize = maxSize;
  }

  get(key) {
    const item = this.items.get(key);
    if (!item) return null;
    if (item.expires && item.expires < Date.now()) {
      this.items.delete(key);
      return null;
    }
    this.items.delete(key);
    this.items.set(key, item);
    return item.value;
  }

  set(key, value, ttl = 300000) {
    if (this.items.has(key)) {
      this.items.delete(key);
    } else if (this.items.size >= this.maxSize) {
      this.items.delete(this.items.keys().next().value);
    }
    this.items.set(key, { value, expires: ttl ? Date.now() + ttl : null });
  }

  delete(key) {
    return this.items.delete(key);
  }
}

const responseCache = new ResponseCache();

function getSafeRequestKey(url, fetchOptions = {}) {
  const method = String(fetchOptions?.method || "GET").toUpperCase();
  if ((method !== "GET" && method !== "HEAD") || fetchOptions.body != null) return null;
  return `${method}:${String(url)}`;
}

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
    const cached = responseCache.get(cacheKey);
    if (cached) {
      try {
        return cached.clone();
      } catch {
        responseCache.delete(cacheKey);
      }
    }
  }

  if (safeRequestKey && inflightRequests.has(safeRequestKey)) {
    const response = await inflightRequests.get(safeRequestKey);
    return response.clone();
  }

  const executeRequest = async () => {
    let lastError;
    for (let attempt = 0; attempt <= retries; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      const { signal: externalSignal, ...requestOptions } = fetchOptions;
      const signal = externalSignal
        ? AbortSignal.any([externalSignal, controller.signal])
        : controller.signal;

      try {
        const response = await fetch(url, {
          ...requestOptions,
          signal,
          credentials: requestOptions.credentials || "same-origin",
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
          if (response.status < 500 || attempt >= retries) {
            if (throwOnHTTPError) throw error;
            return response;
          }
          lastError = error;
          log.warn(`Fetch attempt ${attempt + 1} failed, retrying...`, error);
          await sleep(retryDelay * Math.pow(2, attempt));
          continue;
        }

        if (cacheKey) responseCache.set(cacheKey, response.clone(), cacheTTL);
        return response;
      } catch (error) {
        clearTimeout(timeoutId);
        lastError = error;
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
      }
    }
    log.error(`Fetch failed after ${retries + 1} attempts:`, lastError);
    throw lastError;
  };

  if (!safeRequestKey) return executeRequest();

  const requestPromise = executeRequest();
  inflightRequests.set(safeRequestKey, requestPromise);
  try {
    return await requestPromise;
  } finally {
    inflightRequests.delete(safeRequestKey);
  }
}

export async function fetchJSON(url, config = {}) {
  const response = await fetchWithRetry(url, { cache: true, ...config });
  try {
    return await response.json();
  } catch (error) {
    log.error(`Invalid JSON from ${url}:`, error);
    throw new Error(`Invalid JSON response from ${url}`, { cause: error });
  }
}

export async function fetchText(url, config = {}) {
  const response = await fetchWithRetry(url, config);
  return response.text();
}
