import { createLogger } from "../../logger.js";
import { escapeHtml } from "./text.js";

const log = createLogger("Sanitize");
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
const DEFAULT_ALLOWED_ATTRIBUTES = new Set([
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
const URL_ATTRIBUTES = new Set(["href", "src"]);
const SAFE_URL =
  /^(?:https?:|mailto:|tel:|\/|#|data:image\/(?:png|gif|jpeg|jpg|webp|svg\+xml);base64,)/i;

let domPurifyLoadPromise = null;

function isDomPurifyAvailable() {
  return typeof window !== "undefined" && typeof window.DOMPurify?.sanitize === "function";
}

async function loadDomPurify() {
  if (isDomPurifyAvailable()) return window.DOMPurify;
  if (domPurifyLoadPromise) return domPurifyLoadPromise;

  domPurifyLoadPromise = import(DOMPURIFY_MODULE_URL)
    .then(module => {
      const domPurify = module.default || module.DOMPurify || module;
      if (typeof domPurify?.sanitize !== "function") {
        throw new Error("DOMPurify module invalid");
      }
      if (typeof window !== "undefined") window.DOMPurify = domPurify;
      return domPurify;
    })
    .catch(error => {
      log.warn("DOMPurify load failed:", error);
      return null;
    });
  return domPurifyLoadPromise;
}

function normalizeConfig(options = {}) {
  return {
    allowedTags: new Set(
      Array.isArray(options.ALLOWED_TAGS) && options.ALLOWED_TAGS.length
        ? options.ALLOWED_TAGS
        : DEFAULT_ALLOWED_TAGS
    ),
    allowedAttributes: new Set(
      Array.isArray(options.ALLOWED_ATTR) && options.ALLOWED_ATTR.length
        ? options.ALLOWED_ATTR
        : DEFAULT_ALLOWED_ATTRIBUTES
    ),
  };
}

function sanitizeWithDomPurify(source, config) {
  return window.DOMPurify.sanitize(source, {
    ALLOWED_TAGS: Array.from(config.allowedTags),
    ALLOWED_ATTR: Array.from(config.allowedAttributes),
    RETURN_TRUSTED_TYPE: false,
  });
}

function sanitizeNode(node, config) {
  if (!node) return null;
  if (node.nodeType === 3) return document.createTextNode(node.textContent || "");
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

  const element = document.createElement(tag);
  Array.from(node.attributes || []).forEach(({ name, value }) => {
    const attribute = String(name || "").toLowerCase();
    if (
      !attribute ||
      attribute.startsWith("on") ||
      !config.allowedAttributes.has(attribute) ||
      (URL_ATTRIBUTES.has(attribute) && !SAFE_URL.test(value))
    ) {
      return;
    }
    element.setAttribute(attribute, value);
  });

  if (element instanceof HTMLAnchorElement && element.getAttribute("target") === "_blank") {
    const rel = String(element.getAttribute("rel") || "")
      .split(/\s+/)
      .filter(Boolean);
    element.setAttribute("rel", [...new Set([...rel, "noopener", "noreferrer"])].join(" "));
  }

  node.childNodes.forEach(child => {
    const sanitizedChild = sanitizeNode(child, config);
    if (sanitizedChild) element.appendChild(sanitizedChild);
  });
  return element;
}

export function sanitizeHTML(html, options = {}) {
  if (html == null) return "";
  const source = String(html);
  if (!source) return "";
  if (typeof document === "undefined") return escapeHtml(source);

  try {
    const config = normalizeConfig(options);
    if (typeof window !== "undefined" && !isDomPurifyAvailable()) void loadDomPurify();
    if (isDomPurifyAvailable()) return sanitizeWithDomPurify(source, config);

    const template = document.createElement("template");
    template.innerHTML = source;
    const output = document.createElement("div");
    template.content.childNodes.forEach(child => {
      const sanitized = sanitizeNode(child, config);
      if (sanitized) output.appendChild(sanitized);
    });
    return output.innerHTML;
  } catch (error) {
    log.warn("sanitizeHTML failed, returning escaped text", error);
    return escapeHtml(source);
  }
}

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
