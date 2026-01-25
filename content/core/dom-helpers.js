// DOM helper utilities

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
  } catch {
    return null;
  }
}

/**
 * Upsert meta tag (supports both name and property attributes)
 * @param {string} nameOrProperty - Meta name or property
 * @param {string} content - Meta content
 * @param {boolean} isProperty - Use property attribute instead of name
 */
export function upsertMeta(nameOrProperty, content, isProperty = false) {
  if (!content) return null;
  try {
    const selector = isProperty
      ? `meta[property="${nameOrProperty}"]`
      : `meta[name="${nameOrProperty}"]`;
    let el = document.head.querySelector(selector);
    if (el) {
      el.setAttribute('content', content);
      return el;
    }
    el = document.createElement('meta');
    el.setAttribute(isProperty ? 'property' : 'name', nameOrProperty);
    el.setAttribute('content', content);
    document.head.appendChild(el);
    return el;
  } catch {
    return null;
  }
}

/**
 * Apply canonical and alternate language links
 * @param {Document} doc - Document object
 * @param {Array} alternates - Array of {lang, href} objects
 * @param {string} effectiveCanonical - Canonical URL
 */
export function applyCanonicalLinks(
  doc = typeof document === 'undefined' ? null : document,
  alternates = [],
  effectiveCanonical = '',
) {
  if (!doc?.head) return;

  // Upsert canonical
  const canonicalEl = doc.head.querySelector('link[rel="canonical"]');
  if (canonicalEl) {
    if (typeof canonicalEl.setAttribute === 'function')
      canonicalEl.setAttribute('href', effectiveCanonical);
    else canonicalEl.href = effectiveCanonical;
  } else {
    const el = doc.createElement('link');
    el.setAttribute('rel', 'canonical');
    el.setAttribute('href', effectiveCanonical);
    doc.head.appendChild(el);
  }

  // Upsert alternates
  alternates.forEach(({ lang, href }) => {
    if (!href) return;
    const selector = `link[rel="alternate"][hreflang="${lang}"]`;
    let el = doc.head.querySelector(selector);
    if (el) {
      if (typeof el.setAttribute === 'function') el.setAttribute('href', href);
      else el.href = href;
    } else {
      el = doc.createElement('link');
      el.setAttribute('rel', 'alternate');
      el.setAttribute('hreflang', lang);
      el.setAttribute('href', href);
      doc.head.appendChild(el);
    }
  });
}
