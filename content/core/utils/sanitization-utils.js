/**
 * HTML Sanitization Utilities
 * @version 1.0.0
 */

import { createLogger } from "../logger.js";
import { escapeHtml } from "./text-utils.js";

const log = createLogger("Sanitization");
const DOMPURIFY_MODULE_URL = "https://cdn.jsdelivr.net/npm/dompurify@2.4.0/dist/purify.es.js";

/**
 * @typedef {{ sanitize: (source: string, config?: Record<string, any>) => string }} DOMPurifyLike
 * @typedef {Window & typeof globalThis & { DOMPurify?: DOMPurifyLike }} SanitizerWindow
 * @typedef {{ allowedTags: Set<string>, allowedAttr: Set<string> }} SanitizeConfig
 */

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

/** @type {Promise<DOMPurifyLike|null>|null} */
let domPurifyLoadPromise = null;

/**
 * @returns {SanitizerWindow|null}
 */
function getSanitizerWindow() {
  if (typeof window === "undefined") return null;
  return /** @type {SanitizerWindow} */ (window);
}

function isDomPurifyAvailable() {
  const win = getSanitizerWindow();
  return !!win?.DOMPurify && typeof win.DOMPurify.sanitize === "function";
}

/**
 * @returns {Promise<DOMPurifyLike|null>}
 */
async function loadDomPurify() {
  const win = getSanitizerWindow();
  if (isDomPurifyAvailable()) return win?.DOMPurify || null;
  if (domPurifyLoadPromise) return domPurifyLoadPromise;

  domPurifyLoadPromise = import(/* webpackIgnore: true */ DOMPURIFY_MODULE_URL)
    .then(module => {
      const domPurify = module.default || module.DOMPurify || module;
      if (!domPurify || typeof domPurify.sanitize !== "function") {
        throw new Error("DOMPurify module invalid");
      }
      const nextWindow = getSanitizerWindow();
      if (nextWindow) {
        nextWindow.DOMPurify = domPurify;
      }
      return domPurify;
    })
    .catch(error => {
      log.warn("DOMPurify load failed:", error);
      return null;
    });

  return domPurifyLoadPromise;
}

/**
 * @param {string} source
 * @param {SanitizeConfig} config
 * @returns {string}
 */
function sanitizeWithDomPurify(source, config) {
  const win = getSanitizerWindow();
  if (!win?.DOMPurify) return source;
  const domPurifyConfig = {
    ALLOWED_TAGS: Array.from(config.allowedTags),
    ALLOWED_ATTR: Array.from(config.allowedAttr),
    RETURN_TRUSTED_TYPE: false,
  };
  return win.DOMPurify.sanitize(source, domPurifyConfig);
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

function isSafeUrl(value) {
  const normalized = String(value || "").trim();
  if (!normalized) return false;
  return SAFE_URL_RE.test(normalized);
}

function sanitizeAttrValue(name, value) {
  if (!URL_ATTRS.has(name)) return String(value);
  if (!isSafeUrl(value)) return "";
  return String(value);
}

function enforceAnchorRel(el) {
  if (!(el instanceof HTMLAnchorElement)) return;
  if (el.getAttribute("target") !== "_blank") return;
  const rel = String(el.getAttribute("rel") || "")
    .split(/\s+/)
    .filter(Boolean);
  const merged = new Set([...rel, "noopener", "noreferrer"]);
  el.setAttribute("rel", [...merged].join(" "));
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
    const sanitizedValue = sanitizeAttrValue(attr, value);
    if (!sanitizedValue) return;
    el.setAttribute(attr, sanitizedValue);
  });

  enforceAnchorRel(el);

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
 * @param {string[]} [options.ALLOWED_TAGS] - Allowed HTML tags
 * @param {string[]} [options.ALLOWED_ATTR] - Allowed attributes
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
 * Create DOM nodes from sanitized HTML.
 * @param {string} html - HTML to sanitize and parse
 * @param {Object} [options] - Sanitization options
 * @returns {DocumentFragment}
 */
function createSanitizedFragment(html, options = {}) {
  const fragment = document.createDocumentFragment();
  const sanitized = sanitizeHTML(html, options);
  if (!sanitized) return fragment;

  const parsed = new DOMParser().parseFromString(sanitized, "text/html");
  fragment.append(...Array.from(parsed.body.childNodes));
  return fragment;
}

/**
 * Replace an element's children with sanitized HTML nodes.
 * @param {Element} element - Target element
 * @param {string} html - HTML to sanitize and render
 * @param {Object} [options] - Sanitization options
 */
export function setSanitizedHTML(element, html, options = {}) {
  if (!element) return;
  element.replaceChildren(createSanitizedFragment(html, options));
}
