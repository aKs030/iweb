/**
 * Centralized Core Utilities Module
 * Consolidates DOM, Async, Fetch, Text, URL, Cache, A11y, and React utilities.
 * @author Abdulkerim Sesli
 * @version 7.0.0
 */

import { createLogger } from "../logger.js";
import { BASE_URL } from "../../config/constants.js";
import { SITE_NAME, SITE_OWNER_NAME } from "../../config/site-seo.js";

const getI18n = () => {
  if (typeof globalThis !== "undefined" && globalThis.i18n) {
    return globalThis.i18n;
  }
  throw new Error("i18n is not initialized on globalThis yet.");
};

const log = createLogger("Utils");

// ============================================================================
// 1. ASYNC UTILITIES (formerly async-utils.js)
// ============================================================================

/**
 * Sleep for specified milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
export const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Wait until a subscribed state snapshot satisfies `isReady`.
 * @template T
 * @param {Object} options
 * @returns {Promise<T>}
 */
export function waitForReadyState(options) {
  const {
    getSnapshot,
    isReady,
    subscribe,
    timeout = 0,
    abortSignal = null,
    abortMessage = "Readiness wait aborted",
    timeoutMessage = `Timed out waiting for readiness after ${timeout}ms`,
  } = options;

  const snapshot = getSnapshot();
  if (isReady(snapshot)) {
    return Promise.resolve(snapshot);
  }

  if (abortSignal?.aborted) {
    return Promise.reject(new DOMException(abortMessage, "AbortError"));
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    let timeoutId = null;
    let unsubscribe = () => {};

    const cleanup = () => {
      unsubscribe();
      unsubscribe = () => {};
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      abortSignal?.removeEventListener?.("abort", handleAbort);
    };

    const resolveReady = readySnapshot => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(readySnapshot);
    };

    const rejectWait = error => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };

    const handleAbort = () => {
      rejectWait(new DOMException(abortMessage, "AbortError"));
    };

    unsubscribe = subscribe(nextSnapshot => {
      if (isReady(nextSnapshot)) {
        resolveReady(nextSnapshot);
      }
    });

    if (timeout > 0) {
      timeoutId = setTimeout(() => {
        rejectWait(new Error(timeoutMessage));
      }, timeout);
    }

    abortSignal?.addEventListener?.("abort", handleAbort, { once: true });
  });
}

/**
 * Debounce a synchronous function
 * @param {Function} fn - Function to debounce
 * @param {number} delay - Delay in milliseconds
 * @param {Object} [options] - Debounce options
 * @returns {Function} Debounced function with cancel method
 */
export function debounce(fn, delay, options = {}) {
  const { leading = false, trailing = true } = options;
  let timeoutId = null;
  let lastCallTime = 0;

  const debounced = function (...args) {
    const now = Date.now();
    const timeSinceLastCall = now - lastCallTime;

    const execute = () => {
      lastCallTime = now;
      fn.apply(this, args);
    };

    clearTimeout(timeoutId);

    if (leading && timeSinceLastCall > delay) {
      execute();
    }

    if (trailing) {
      timeoutId = setTimeout(() => {
        const elapsed = Date.now() - lastCallTime;
        if (!leading || elapsed >= delay) {
          lastCallTime = Date.now();
          fn.apply(this, args);
        }
      }, delay);
    }
  };

  debounced.cancel = () => {
    clearTimeout(timeoutId);
    timeoutId = null;
  };

  return debounced;
}

/**
 * Throttle a function
 * @param {Function} func - Function to throttle
 * @param {number} [limit=250] - Limit in milliseconds
 * @param {Object} [options] - Throttle options
 * @returns {Function} Throttled function with cancel method
 */
export function throttle(func, limit = 250, options = {}) {
  const { leading = true, trailing = true } = options;
  let inThrottle = false;
  let lastArgs = null;
  let timeoutId = null;

  const throttled = function (...args) {
    if (!inThrottle) {
      if (leading) {
        func.apply(this, args);
      }
      inThrottle = true;

      timeoutId = setTimeout(() => {
        inThrottle = false;
        if (trailing && lastArgs) {
          func.apply(this, lastArgs);
          lastArgs = null;
        }
      }, limit);
    } else if (trailing) {
      lastArgs = args;
    }
  };

  throttled.cancel = () => {
    clearTimeout(timeoutId);
    inThrottle = false;
    lastArgs = null;
  };

  return throttled;
}

/**
 * Handle same-page scroll navigation
 * @param {string} url - URL to check
 * @returns {boolean} True if navigation was handled
 */
export function handleSamePageScroll(url) {
  try {
    const parsed = new URL(url, location.origin);
    if (parsed.origin !== location.origin) return false;
    if (parsed.pathname === location.pathname && parsed.search === location.search) {
      if (!parsed.hash) {
        window.scrollTo({ top: 0, behavior: "smooth" });
        return true;
      }
    }
  } catch {
    // malformed URL
  }
  return false;
}

/**
 * Schedule a callback for browser idle time with a timeout-backed fallback.
 * @param {() => void} callback
 * @param {Object} [options]
 * @returns {{ cancel: () => void }}
 */
export function scheduleIdleTask(callback, { timeout = 0, fallbackDelay = timeout } = {}) {
  if (globalThis.requestIdleCallback) {
    const id = requestIdleCallback(callback, timeout > 0 ? { timeout } : undefined);
    return { cancel: () => cancelIdleCallback(id) };
  }
  const id = setTimeout(callback, fallbackDelay || 0);
  return { cancel: () => clearTimeout(id) };
}

/**
 * Cancel a previously scheduled idle task.
 * @param {Object} [handle]
 */
export function cancelIdleTask(handle) {
  handle?.cancel?.();
}

// ============================================================================
// 2. CACHE UTILITIES (formerly cache.js)
// ============================================================================

/**
 * In-memory cache manager with TTL support and LRU eviction policy
 */
class CacheManager {
  constructor(options = {}) {
    this.items = new Map();
    this.maxSize = options.memorySize ?? 50;
  }

  get(key) {
    const item = this.items.get(key);
    if (!item) {
      log.debug(`Cache miss: ${key}`);
      return null;
    }
    if (item.expires && item.expires < Date.now()) {
      this.items.delete(key);
      log.debug(`Cache expired: ${key}`);
      return null;
    }
    this.items.delete(key);
    this.items.set(key, item);
    log.debug(`Cache hit: ${key}`);
    return item.value;
  }

  set(key, value, options = {}) {
    const ttl = options.ttl ?? 300000;
    if (this.items.has(key)) {
      this.items.delete(key);
    } else if (this.items.size >= this.maxSize) {
      const oldestKey = this.items.keys().next().value;
      this.items.delete(oldestKey);
    }
    this.items.set(key, {
      value,
      expires: ttl ? Date.now() + ttl : null,
    });
  }

  delete(key) {
    return this.items.delete(key);
  }
}

let globalCache = null;

/**
 * Get or create a global singleton cache instance
 * @param {Object} [options] - Cache configuration
 * @returns {CacheManager} Global cache instance
 */
function getCache(options) {
  if (!globalCache) {
    globalCache = new CacheManager(options);
  }
  return globalCache;
}

// ============================================================================
// 3. CSP NONCE UTILITIES (formerly csp-nonce.js)
// ============================================================================

/**
 * Read the active CSP nonce from the current document.
 * @returns {string}
 */
export function getCspNonce() {
  if (getCspNonce.cached) return getCspNonce.cached;
  if (typeof document === "undefined") return "";

  const currentScript =
    document.currentScript instanceof HTMLScriptElement ? document.currentScript : null;
  const currentScriptNonce = currentScript?.nonce || "";
  if (currentScriptNonce) {
    getCspNonce.cached = currentScriptNonce;
    return getCspNonce.cached;
  }

  const nonceSource = document.querySelector("script[nonce], style[nonce]");
  const resolvedNonce =
    nonceSource instanceof HTMLElement
      ? nonceSource.nonce || nonceSource.getAttribute("nonce") || ""
      : "";

  if (resolvedNonce) {
    getCspNonce.cached = resolvedNonce;
  }
  return getCspNonce.cached || "";
}

/**
 * Apply the active CSP nonce to a dynamically created node when available.
 * @template {HTMLElement} T
 * @param {T} element
 * @returns {T}
 */
export function applyCspNonce(element) {
  const nonce = getCspNonce();
  if (!nonce) return element;
  element.nonce = nonce;
  element.setAttribute("nonce", nonce);
  return element;
}

// ============================================================================
// 4. DOM UTILITIES (formerly dom-utils.js)
// ============================================================================

/**
 * Safe getElementById wrapper
 * @param {string} id - Element ID
 * @returns {HTMLElement|null}
 */
export function getElementById(id) {
  return id ? document.getElementById(id) : null;
}

/**
 * Execute callback when DOM is ready
 * @param {Function} callback - Function to execute
 * @param {Object} [options={ once: true }] - Options for addEventListener
 */
export function onDOMReady(callback, options = { once: true }) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", callback, options);
  } else {
    callback();
  }
}

/**
 * Upsert a link element in the head
 * @param {Object} [options] - Link attributes
 * @returns {HTMLLinkElement|null}
 */
export function upsertHeadLink(options = {}) {
  const { rel = "", href = "", as, crossOrigin, dataset = {}, id, attrs = {}, onload } = options;
  if (!href || !rel) return null;
  try {
    const selector = as
      ? `link[rel="${rel}"][href="${href}"][as="${as}"]`
      : `link[rel="${rel}"][href="${href}"]`;
    let el = document.head.querySelector(selector);
    if (el) return el;

    el = document.createElement("link");
    el.rel = rel;
    el.href = href;
    if (as) el.as = as;
    if (crossOrigin) el.crossOrigin = crossOrigin;
    if (id) el.id = id;
    Object.entries(dataset || {}).forEach(([key, value]) => {
      el.dataset[key] = value;
    });
    Object.entries(attrs || {}).forEach(([key, value]) => {
      el.setAttribute(key, value);
    });
    if (typeof onload === "function") {
      el.onload = onload;
    }
    document.head.appendChild(el);
    return el;
  } catch {
    return null;
  }
}

/**
 * Load or reuse a stylesheet link in the document head and resolve once it is ready for use.
 * @param {string} href
 * @param {Object} [options]
 * @returns {Promise<HTMLLinkElement|null>}
 */
export function loadHeadStylesheet(href, options = {}) {
  if (!href || typeof document === "undefined" || !document.head) {
    return Promise.resolve(null);
  }

  const { injectedBy = "", dataset = {}, attrs = {} } = options;
  const nextDataset = { ...dataset };
  if (injectedBy) {
    nextDataset.injectedBy = injectedBy;
  }

  return new Promise(resolve => {
    const existing = document.head.querySelector(`link[rel="stylesheet"][href="${href}"]`);
    if (existing) {
      if (existing.dataset.loaded === "true" || existing.sheet) {
        existing.dataset.loaded = "true";
        resolve(existing);
        return;
      }
      const finalizeExisting = () => {
        existing.dataset.loaded = "true";
        resolve(existing);
      };
      existing.addEventListener("load", finalizeExisting, { once: true });
      existing.addEventListener("error", () => resolve(existing), { once: true });
      return;
    }

    const link = upsertHeadLink({
      rel: "stylesheet",
      href,
      attrs: { media: "all", ...attrs },
      dataset: nextDataset,
    });

    if (!link) {
      resolve(null);
      return;
    }

    if (link.sheet) {
      link.dataset.loaded = "true";
      resolve(link);
      return;
    }

    link.addEventListener(
      "load",
      () => {
        link.dataset.loaded = "true";
        resolve(link);
      },
      { once: true }
    );
    link.addEventListener("error", () => resolve(link), { once: true });
  });
}

/**
 * Upsert a meta element in the head
 * @param {string} nameOrProperty - Meta name or property
 * @param {string} content - Meta content
 * @param {boolean} [isProperty=false] - True if property attribute
 * @returns {Element|null}
 */
export function upsertMeta(nameOrProperty, content, isProperty = false) {
  if (!content) return null;
  try {
    const selector = isProperty
      ? `meta[property="${nameOrProperty}"]`
      : `meta[name="${nameOrProperty}"]`;
    let el = document.head.querySelector(selector);
    if (el) {
      el.setAttribute("content", content);
      return el;
    }
    el = document.createElement("meta");
    el.setAttribute(isProperty ? "property" : "name", nameOrProperty);
    el.setAttribute("content", content);
    document.head.appendChild(el);
    return el;
  } catch {
    return null;
  }
}

/**
 * Create an intersection observer wrapper
 * @param {IntersectionObserverCallback} callback - Observer callback
 * @param {IntersectionObserverInit} [options] - Observer options
 * @returns {Object} Observer wrapper with helper methods
 */
export function createObserver(callback, options = {}) {
  const observer = new IntersectionObserver(callback, options);
  return {
    observe: el => observer.observe(el),
    unobserve: el => observer.unobserve(el),
    disconnect: () => observer.disconnect(),
    raw: observer,
  };
}

/**
 * Observe element once and disconnect
 * @param {Element} target - Element to observe
 * @param {Function} onIntersect - Callback when intersecting
 * @param {IntersectionObserverInit} [options] - Observer options
 * @returns {Function} Cleanup function
 */
export function observeOnce(target, onIntersect, options = {}) {
  if (!target) return () => {};
  const obs = new IntersectionObserver((entries, o) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        try {
          onIntersect(entry);
        } finally {
          o.disconnect();
        }
        break;
      }
    }
  }, options);

  obs.observe(target);
  return () => obs.disconnect();
}

/**
 * Add an event listener with a small passive-by-default policy and return a cleanup function.
 * @param {EventTarget} target
 * @param {string} event
 * @param {EventListener} handler
 * @param {Object} [options]
 * @returns {() => void}
 */
export function addManagedEventListener(target, event, handler, options = {}) {
  if (!target || typeof target.addEventListener !== "function") {
    return () => {};
  }
  const passiveByDefault = event === "touchstart" || event === "touchmove" || event === "wheel";
  const normalizedOptions =
    options && typeof options === "object" ? { passive: passiveByDefault, ...options } : options;

  target.addEventListener(event, handler, normalizedOptions);
  return () => target.removeEventListener(event, handler, normalizedOptions);
}

// ============================================================================
// 5. FETCH UTILITIES (formerly fetch.js)
// ============================================================================

const HTTP_PROTOCOLS = new Set(["http:", "https:"]);
const cacheManager = getCache({ memorySize: 100 });
const _inflight = new Map();

const getSafeRequestKey = (url, fetchOptions = {}) => {
  const method = String(fetchOptions?.method || "GET").toUpperCase();
  if (method !== "GET" && method !== "HEAD") return null;
  if ("body" in fetchOptions && fetchOptions.body != null) return null;
  return `${method}:${String(url)}`;
};

/**
 * Modern fetch with timeout, retry, and caching
 * @param {string} url - URL to fetch
 * @param {Object} [config] - Fetch configuration
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
      const combinedSignal = externalSignal
        ? AbortSignal.any([externalSignal, controller.signal])
        : controller.signal;

      try {
        const response = await fetch(url, {
          ...requestOptions,
          signal: combinedSignal,
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

        if (cacheKey) {
          cacheManager.set(cacheKey, response.clone(), { ttl: cacheTTL });
        }
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
 * @param {Object} [config] - Fetch configuration
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
 * @param {Object} [config] - Fetch configuration
 * @returns {Promise<string>} Response text
 */
export async function fetchText(url, config = {}) {
  const response = await fetchWithRetry(url, config);
  return response.text();
}

// ============================================================================
// 6. PATH UTILITIES (formerly path-utils.js)
// ============================================================================

/**
 * Canonicalize URL path (remove .html, trailing slashes, etc.)
 * @param {string} path - Path to canonicalize
 * @returns {string} Canonicalized path
 */
export function canonicalizeUrlPath(path) {
  if (!path) return "/";
  let normalized = String(path).trim();
  if (!normalized.startsWith("/")) {
    normalized = "/" + normalized;
  }
  if (normalized.endsWith("/index.html")) {
    normalized = normalized.substring(0, normalized.length - 11);
  } else if (normalized.endsWith(".html")) {
    normalized = normalized.substring(0, normalized.length - 5);
  }
  if (normalized === "") return "/";
  if (normalized !== "/" && normalized.endsWith("/")) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}

/**
 * Normalize pathname by removing query strings, hashes, multiple slashes, and trailing slashes
 * @param {string} pathname - Pathname to normalize
 * @returns {string} Normalized pathname
 */
export function normalizePathname(pathname) {
  const source = String(pathname || "/");
  const noQuery = source.split("?")[0] || "";
  const noHash = noQuery.split("#")[0] || "";
  const normalized = noHash.replace(/\/+/g, "/");
  return normalized === "" || normalized === "/" ? "/" : normalized.replace(/\/$/, "");
}

// ============================================================================
// 7. HTML SANITIZATION UTILITIES (formerly sanitization-utils.js)
// ============================================================================

const DOMPURIFY_MODULE_URL = "https://cdn.jsdelivr.net/npm/dompurify@2.4.0/dist/purify.es.js";

const DEFAULT_ALLOWED_TAGS = new Set([
  "a",
  "b",
  "blockquote",
  "br",
  "code",
  "div",
  "em",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "i",
  "img",
  "li",
  "mark",
  "ol",
  "p",
  "pre",
  "small",
  "span",
  "strong",
  "sub",
  "sup",
  "table",
  "tbody",
  "td",
  "th",
  "thead",
  "tr",
  "u",
  "ul",
]);

const DEFAULT_ALLOWED_ATTR = new Set([
  "alt",
  "aria-label",
  "class",
  "decoding",
  "height",
  "href",
  "id",
  "lang",
  "loading",
  "rel",
  "role",
  "src",
  "target",
  "title",
  "width",
]);

const URL_ATTRS = new Set(["href", "src"]);
const SAFE_URL_RE =
  /^(?:https?:|mailto:|tel:|\/|#|data:image\/(?:png|gif|jpeg|jpg|webp|svg\+xml);base64,)/i;

let domPurifyLoadPromise = null;

function isDomPurifyAvailable() {
  if (typeof window === "undefined") return false;
  return !!window.DOMPurify && typeof window.DOMPurify.sanitize === "function";
}

async function loadDomPurify() {
  if (isDomPurifyAvailable()) return window.DOMPurify || null;
  if (domPurifyLoadPromise) return domPurifyLoadPromise;

  domPurifyLoadPromise = import(DOMPURIFY_MODULE_URL)
    .then(module => {
      const domPurify = module.default || module.DOMPurify || module;
      if (!domPurify || typeof domPurify.sanitize !== "function") {
        throw new Error("DOMPurify module invalid");
      }
      if (typeof window !== "undefined") {
        window.DOMPurify = domPurify;
      }
      return domPurify;
    })
    .catch(error => {
      log.warn("DOMPurify load failed:", error);
      return null;
    });
  return domPurifyLoadPromise;
}

function sanitizeWithDomPurify(source, config) {
  if (typeof window === "undefined" || !window.DOMPurify) return source;
  const domPurifyConfig = {
    ALLOWED_TAGS: Array.from(config.allowedTags),
    ALLOWED_ATTR: Array.from(config.allowedAttr),
    RETURN_TRUSTED_TYPE: false,
  };
  return window.DOMPurify.sanitize(source, domPurifyConfig);
}

function normalizeSanitizeConfig(options = {}) {
  const allowedTags = new Set(
    Array.isArray(options.ALLOWED_TAGS) && options.ALLOWED_TAGS.length
      ? options.ALLOWED_TAGS
      : [...DEFAULT_ALLOWED_TAGS]
  );
  const allowedAttr = new Set(
    Array.isArray(options.ALLOWED_ATTR) && options.ALLOWED_ATTR.length
      ? options.ALLOWED_ATTR
      : [...DEFAULT_ALLOWED_ATTR]
  );
  return { allowedTags, allowedAttr };
}

function sanitizeNode(node, config) {
  if (!node) return null;
  if (node.nodeType === 3) {
    return document.createTextNode(node.textContent || "");
  }
  if (node.nodeType !== 1) return null;

  const tag = String(node.nodeName || "").toLowerCase();
  if (!config.allowedTags.has(tag)) {
    const fragment = document.createDocumentFragment();
    node.childNodes.forEach(child => {
      const sanitizedChild = sanitizeNode(child, config);
      if (sanitizedChild) fragment.appendChild(sanitizedChild);
    });
    return fragment;
  }

  const el = document.createElement(tag);
  const attrs = Array.from(node.attributes || []);
  attrs.forEach(({ name, value }) => {
    const attr = String(name || "").toLowerCase();
    if (!attr || attr.startsWith("on")) return;
    if (!config.allowedAttr.has(attr)) return;
    if (URL_ATTRS.has(attr) && !SAFE_URL_RE.test(value)) return;
    el.setAttribute(attr, value);
  });

  if (el instanceof HTMLAnchorElement && el.getAttribute("target") === "_blank") {
    const rel = String(el.getAttribute("rel") || "")
      .split(/\s+/)
      .filter(Boolean);
    el.setAttribute("rel", [...new Set([...rel, "noopener", "noreferrer"])].join(" "));
  }

  node.childNodes.forEach(child => {
    const sanitizedChild = sanitizeNode(child, config);
    if (sanitizedChild) el.appendChild(sanitizedChild);
  });
  return el;
}

/**
 * Sanitize HTML string
 * @param {string} html - HTML to sanitize
 * @param {Object} [options] - Sanitization options
 * @returns {string} Sanitized HTML
 */
export function sanitizeHTML(html, options = {}) {
  if (html == null) return "";
  const source = String(html);
  if (!source) return "";
  if (typeof document === "undefined") {
    return escapeHtml(source);
  }

  try {
    const config = normalizeSanitizeConfig(options);
    if (typeof window !== "undefined" && !isDomPurifyAvailable()) {
      void loadDomPurify();
    }
    if (isDomPurifyAvailable()) {
      return sanitizeWithDomPurify(source, config);
    }

    const template = document.createElement("template");
    template.innerHTML = source;
    const out = document.createElement("div");

    template.content.childNodes.forEach(child => {
      const sanitized = sanitizeNode(child, config);
      if (sanitized) out.appendChild(sanitized);
    });
    return out.innerHTML;
  } catch (err) {
    log.warn("sanitizeHTML failed, returning escaped text", err);
    return escapeHtml(source);
  }
}

/**
 * Replace an element's children with sanitized HTML nodes.
 * @param {Element} element - Target element
 * @param {string} html - HTML to sanitize and render
 * @param {Object} [options] - Sanitization options
 */
export function setSanitizedHTML(element, html, options = {}) {
  if (!element) return;
  const fragment = document.createDocumentFragment();
  const sanitized = sanitizeHTML(html, options);
  if (sanitized) {
    const parsed = new DOMParser().parseFromString(sanitized, "text/html");
    fragment.append(...Array.from(parsed.body.childNodes));
  }
  element.replaceChildren(fragment);
}

// ============================================================================
// 8. TEXT UTILITIES (formerly text-utils.js)
// ============================================================================

/**
 * Normalize text with optional fallback
 * @param {string} value - Text to normalize
 * @param {string} [fallback=''] - Fallback value
 * @returns {string} Normalized text
 */
export function normalizeText(value, fallback = "") {
  return String(value ?? "").trim() || fallback;
}

/**
 * Normalize text and collapse whitespace
 * @param {string} value - Text to normalize
 * @returns {string} Normalized text
 */
export function normalizeSchemaText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Normalize text for case-insensitive matching
 * @param {string} value - Text to normalize
 * @returns {string} Normalized lowercase text
 */
export function normalizeForMatch(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Create unique list from values
 * @param {Array<string>} values - Values to deduplicate
 * @returns {string[]} Unique values
 */
export function uniqueSchemaList(values) {
  const result = [];
  const seen = new Set();
  for (const raw of values || []) {
    const value = normalizeSchemaText(raw);
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  return result;
}

/**
 * Format slug to readable text
 * @param {string} slug - Slug to format
 * @returns {string} Formatted text
 */
export function formatSlug(slug = "") {
  return String(slug)
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Humanize slug with capitalization
 * @param {string} value - Slug to humanize
 * @returns {string} Humanized text
 */
export function humanizeSlug(value) {
  return String(value || "")
    .replace(/[_+]/g, "-")
    .split("-")
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
    .trim();
}

/**
 * Sanitize discovery text (remove unwanted patterns)
 * @param {string} value - Text to sanitize
 * @param {string} fallback - Fallback value
 * @returns {string} Sanitized text
 */
export function sanitizeDiscoveryText(value, fallback = "") {
  const source = normalizeText(value, fallback);
  if (!source) return "";
  return source
    .replace(/Abdul\s*Berlin/gi, "Abdulkerim Sesli")
    .replace(/\bBerlin\b/gi, "")
    .replace(/#Abdulberlin/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
}

/**
 * Escape HTML entities to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} HTML-safe text
 */
export function escapeHtml(text) {
  if (!text) return "";
  const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return String(text).replace(/[&<>"']/g, char => entities[char] || char);
}

/**
 * Escape special regex characters
 * @param {string} value - Text to escape
 * @returns {string} Regex-safe text
 */
export function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Strip branding suffixes from titles
 * @param {string} input - Text to strip
 * @returns {string} Text without branding
 */
// Compiled once at module load — SITE_NAME and SITE_OWNER_NAME are static constants.
const BRAND_REGEX = new RegExp(
  `\\s*(?:[—–-]\\s*${escapeRegExp(SITE_OWNER_NAME)}|\\|\\s*${escapeRegExp(
    SITE_OWNER_NAME
  )}|${escapeRegExp(SITE_NAME)})\\s*$`,
  "i"
);

export function stripBranding(input) {
  return String(input || "")
    .replace(BRAND_REGEX, "")
    .trim();
}

/**
 * Escape XML special characters
 * @param {string} value - Text to escape
 * @returns {string} XML-safe text
 */
export function escapeXml(value) {
  return String(value ?? "").replace(/[<>&'"]/g, char => {
    switch (char) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "&":
        return "&amp;";
      case "'":
        return "&apos;";
      case '"':
        return "&quot;";
      default:
        return char;
    }
  });
}

// ============================================================================
// 9. TIMER Lifecycle MANAGER (formerly timer-manager.js)
// ============================================================================

export class TimerManager {
  constructor(name = "TimerManager") {
    this.name = name;
    this.timers = new Set();
    this.intervals = new Set();
    this.rafIds = new Set();
  }

  _runSafely(label, fn) {
    try {
      fn();
    } catch (err) {
      log.error(`[${this.name}] ${label} error:`, err);
    }
  }

  setTimeout(fn, delay) {
    const id = setTimeout(() => {
      this.timers.delete(id);
      this._runSafely("setTimeout", fn);
    }, delay);
    this.timers.add(id);
    return id;
  }

  setInterval(fn, delay) {
    const id = setInterval(() => {
      this._runSafely("setInterval", fn);
    }, delay);
    this.intervals.add(id);
    return id;
  }

  requestAnimationFrame(fn) {
    const id = requestAnimationFrame(() => {
      this.rafIds.delete(id);
      this._runSafely("RAF", fn);
    });
    this.rafIds.add(id);
    return id;
  }

  clearTimeout(id) {
    clearTimeout(id);
    this.timers.delete(id);
  }

  clearInterval(id) {
    clearInterval(id);
    this.intervals.delete(id);
  }

  cancelAnimationFrame(id) {
    cancelAnimationFrame(id);
    this.rafIds.delete(id);
  }

  clearAll() {
    this.timers.forEach(id => clearTimeout(id));
    this.intervals.forEach(id => clearInterval(id));
    this.rafIds.forEach(id => cancelAnimationFrame(id));
    this.timers.clear();
    this.intervals.clear();
    this.rafIds.clear();
  }

  get activeTimers() {
    return {
      timeouts: this.timers.size,
      intervals: this.intervals.size,
      rafs: this.rafIds.size,
      total: this.timers.size + this.intervals.size + this.rafIds.size,
    };
  }
}

// ============================================================================
// 10. URL UTILITIES (formerly url-utils.js)
// ============================================================================

function getDefaultBaseUrl() {
  return globalThis.location?.origin || BASE_URL;
}

function normalizeHostname(hostname) {
  return String(hostname || "")
    .trim()
    .toLowerCase();
}

function getTrustedInternalHosts(currentHostname = globalThis.location?.hostname) {
  const hosts = new Set();
  const pushHost = value => {
    const normalized = normalizeHostname(value);
    if (!normalized) return;
    hosts.add(normalized);
    if (normalized.startsWith("www.")) {
      hosts.add(normalized.replace(/^www\./, ""));
    } else {
      hosts.add(`www.${normalized}`);
    }
  };
  pushHost(currentHostname);
  try {
    pushHost(new URL(BASE_URL).hostname);
  } catch {
    // ignore
  }
  return hosts;
}

function parseUrl(rawUrl, options = {}) {
  const value = String(rawUrl || "").trim();
  if (!value) return null;
  try {
    return new URL(value, options.base || getDefaultBaseUrl());
  } catch {
    return null;
  }
}

/**
 * Normalize an absolute or relative http(s) URL to an absolute string.
 * @param {string} rawUrl
 * @param {Object} [options]
 * @returns {string}
 */
export function normalizeHttpUrl(rawUrl, options = {}) {
  const parsed = parseUrl(rawUrl, options);
  if (!parsed || !HTTP_PROTOCOLS.has(parsed.protocol)) return "";
  return parsed.toString();
}

/**
 * Convert an internal URL to a safe relative navigation target.
 * @param {string} rawUrl
 * @param {Object} [options]
 * @returns {string}
 */
export function sanitizeInternalNavigationUrl(rawUrl, options = {}) {
  const parsed = parseUrl(rawUrl, options);
  if (!parsed || !HTTP_PROTOCOLS.has(parsed.protocol)) return "";

  const allowedHosts = new Set(
    Array.from(
      options.allowedHosts || getTrustedInternalHosts(globalThis.location?.hostname),
      host => normalizeHostname(host)
    )
  );
  if (!allowedHosts.has(normalizeHostname(parsed.hostname))) {
    return "";
  }
  return `${parsed.pathname}${parsed.search}${parsed.hash}` || "/";
}

/**
 * Format a URL for compact UI display
 * @param {string} rawUrl
 * @param {Object} [options]
 * @returns {string}
 */
export function formatCompactUrlPath(rawUrl, options = {}) {
  const fallback = String(rawUrl || "").trim();
  if (!fallback) return "";

  const parsed = parseUrl(fallback, options);
  if (!parsed) {
    const fallbackMaxLength = Number(options.fallbackMaxLength || 46);
    return fallback.length > fallbackMaxLength
      ? `${fallback.slice(0, fallbackMaxLength - 3)}...`
      : fallback;
  }

  const basePath = parsed.pathname || "/";
  const maxPathLength = Number(options.maxPathLength || 44);
  const compactPath =
    basePath.length > maxPathLength
      ? `${basePath.slice(0, maxPathLength - 3).replace(/\/+$/g, "")}...`
      : basePath;
  return `${compactPath}${parsed.search}`;
}

// ============================================================================
// 11. REACT-SPECIFIC UTILITIES (formerly react-utils.js)
// ============================================================================

/**
 * Creates a `useTranslation` React hook for functional components.
 * Re-renders the component whenever the active language changes.
 * @returns {() => { t: (key: string, params?: Object) => string, lang: string }}
 */
export const createUseTranslation = ReactInstance => {
  const R = ReactInstance || globalThis.React;
  if (!R) {
    throw new Error("React instance must be passed to createUseTranslation(React)");
  }
  return () => {
    const i18n = getI18n();
    const [state, setState] = R.useState({
      lang: i18n.currentLang,
      version: 0,
    });

    R.useEffect(() => {
      let mounted = true;
      const update = (lang = i18n.currentLang) => {
        if (!mounted) return;
        setState(prev => ({
          lang,
          version: prev.version + 1,
        }));
      };
      const onLangChange = e => update(e.detail.lang);
      i18n.addEventListener("language-changed", onLangChange);
      i18n
        .init()
        .then(() => update(i18n.currentLang))
        .catch(() => update(i18n.currentLang));
      return () => {
        mounted = false;
        i18n.removeEventListener("language-changed", onLangChange);
      };
    }, []);

    const t = R.useCallback((key, params) => i18n.t(key, params), [state.lang, state.version]);
    return R.useMemo(() => ({ t, lang: state.lang }), [t, state.lang]);
  };
};
