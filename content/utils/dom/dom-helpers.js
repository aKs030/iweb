// DOM helper utilities for head manipulation and link/meta upserts

/* eslint-disable-next-line import/no-unused-modules */
export function upsertHeadLink({
  rel,
  href,
  as,
  crossOrigin,
  dataset = {},
  id,
  attrs = {},
  onload,
} = {}) {
  if (!href || !rel) return null;
  try {
    // Prefer unique match by rel+href (+as when given)
    const selector = as
      ? `link[rel="${rel}"][href="${href}"][as="${as}"]`
      : `link[rel="${rel}"][href="${href}"]`;
    let el = document.head.querySelector(selector);
    if (el) return el;

    el = document.createElement('link');
    el.rel = rel;
    el.href = href;
    if (as) el.as = as;
    if (crossOrigin) el.crossOrigin = crossOrigin;
    if (id) el.id = id;
    Object.keys(dataset || {}).forEach((k) => {
      el.dataset[k] = dataset[k];
    });
    Object.keys(attrs || {}).forEach((k) => el.setAttribute(k, attrs[k]));
    if (typeof onload === 'function') el.onload = onload;
    document.head.appendChild(el);
    return el;
  } catch (e) {
    // Silent fallback
    return null;
  }
}

/* eslint-disable-next-line import/no-unused-modules */
export function upsertMeta({ name, property, content }) {
  try {
    const selector = property
      ? `meta[property="${property}"]`
      : `meta[name="${name}"]`;
    let el = document.head.querySelector(selector);
    if (el) {
      el.setAttribute(property ? 'property' : 'name', property || name);
      el.setAttribute('content', content);
      return el;
    }
    el = document.createElement('meta');
    if (property) el.setAttribute('property', property);
    else el.setAttribute('name', name);
    el.setAttribute('content', content);
    document.head.appendChild(el);
    return el;
  } catch (e) {
    return null;
  }
}

/**
 * Enhanced getElementById with caching
 * @param {string} id - Element ID to find
 * @returns {Element|null} Found element or null
 */
export function getElementById(id) {
  if (!id) return null;
  try {
    return document.getElementById(id);
  } catch {
    return null;
  }
}

/**
 * Create an AbortController with timeout
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Object} Controller object with signal and cleanup
 */
export function makeAbortController(timeout = 8000) {
  const controller = new AbortController();

  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeout);

  const clearTimeout = () => {
    clearTimeout(timeoutId);
  };

  return {
    controller,
    signal: controller.signal,
    clearTimeout,
  };
}

/**
 * Clear DOM cache (placeholder for future caching implementation)
 */
export function clearDOMCache() {
  // Placeholder for future DOM caching implementation
}
