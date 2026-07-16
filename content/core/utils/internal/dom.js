let cachedNonce = "";

function getCspNonce() {
  if (cachedNonce || typeof document === "undefined") return cachedNonce;

  const currentScript =
    document.currentScript instanceof HTMLScriptElement ? document.currentScript : null;
  cachedNonce = currentScript?.nonce || "";
  if (cachedNonce) return cachedNonce;

  const nonceSource = document.querySelector("script[nonce], style[nonce]");
  cachedNonce =
    nonceSource instanceof HTMLElement
      ? nonceSource.nonce || nonceSource.getAttribute("nonce") || ""
      : "";
  return cachedNonce;
}

export function applyCspNonce(element) {
  const nonce = getCspNonce();
  if (!nonce) return element;
  element.nonce = nonce;
  element.setAttribute("nonce", nonce);
  return element;
}

export function getElementById(id) {
  return id ? document.getElementById(id) : null;
}

export function upsertHeadLink(options = {}) {
  const { rel = "", href = "", as, crossOrigin, dataset = {}, id, attrs = {}, onload } = options;
  if (!href || !rel) return null;

  try {
    const selector = as
      ? `link[rel="${rel}"][href="${href}"][as="${as}"]`
      : `link[rel="${rel}"][href="${href}"]`;
    let link = document.head.querySelector(selector);
    if (link) return link;

    link = document.createElement("link");
    link.rel = rel;
    link.href = href;
    if (as) link.as = as;
    if (crossOrigin) link.crossOrigin = crossOrigin;
    if (id) link.id = id;

    Object.entries(dataset).forEach(([key, value]) => {
      link.dataset[key] = value;
    });
    Object.entries(attrs).forEach(([key, value]) => {
      link.setAttribute(key, value);
    });
    if (typeof onload === "function") link.onload = onload;

    document.head.appendChild(link);
    return link;
  } catch {
    return null;
  }
}

export function loadHeadStylesheet(href, options = {}) {
  if (!href || typeof document === "undefined" || !document.head) {
    return Promise.resolve(null);
  }

  const { injectedBy = "", dataset = {}, attrs = {} } = options;
  const nextDataset = { ...dataset };
  if (injectedBy) nextDataset.injectedBy = injectedBy;

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

export function upsertMeta(nameOrProperty, content, isProperty = false) {
  if (!content) return null;
  try {
    const selector = isProperty
      ? `meta[property="${nameOrProperty}"]`
      : `meta[name="${nameOrProperty}"]`;
    let meta = document.head.querySelector(selector);
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute(isProperty ? "property" : "name", nameOrProperty);
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", content);
    return meta;
  } catch {
    return null;
  }
}

export function createObserver(callback, options = {}) {
  const observer = new IntersectionObserver(callback, options);
  return {
    observe: element => observer.observe(element),
    unobserve: element => observer.unobserve(element),
    disconnect: () => observer.disconnect(),
    raw: observer,
  };
}

export function observeOnce(target, onIntersect, options = {}) {
  if (!target) return () => {};
  const observer = new IntersectionObserver((entries, instance) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      try {
        onIntersect(entry);
      } finally {
        instance.disconnect();
      }
      break;
    }
  }, options);

  observer.observe(target);
  return () => observer.disconnect();
}

export function addManagedEventListener(target, event, handler, options = {}) {
  if (!target || typeof target.addEventListener !== "function") return () => {};

  const passiveByDefault = event === "touchstart" || event === "touchmove" || event === "wheel";
  const normalizedOptions =
    options && typeof options === "object" ? { passive: passiveByDefault, ...options } : options;

  target.addEventListener(event, handler, normalizedOptions);
  return () => target.removeEventListener(event, handler, normalizedOptions);
}
