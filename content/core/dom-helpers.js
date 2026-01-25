// DOM helper utilities for head manipulation and link/meta upserts

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
  } catch {
    // Silent fallback
    return null;
  }
}

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
  } catch {
    return null;
  }
}
