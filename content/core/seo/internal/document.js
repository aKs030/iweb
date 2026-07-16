/** Canonical-link management and DOM content extraction. */

import { BASE_URL } from "../../../config/constants.js";
import { createLogger } from "../../logger.js";
import { buildProjectDetailPath, extractProjectSlug } from "../../project-paths.js";
import { isLocalDevHost } from "../../runtime-env.js";
import { upsertHeadLink, normalizeSchemaText, uniqueSchemaList } from "../../utils/index.js";

const log = createLogger("DocumentSEO");
const normalizeText = normalizeSchemaText;
const uniqueList = uniqueSchemaList;

// ============================================================================
// 1. CANONICAL LINKS
// ============================================================================

function isLocalDevelopment() {
  return isLocalDevHost();
}

function isPreviewEnvironment() {
  const hostname = globalThis.location?.hostname?.toLowerCase() || "";
  return hostname.includes(".pages.dev") || hostname.includes("preview");
}

function computeCleanPath() {
  const rawPath = globalThis.location.pathname || "/";
  let cleanPath = rawPath
    .replace(/\/\/+/g, "/")
    .replace(/\/index\.html$/i, "/")
    .replace(/\.html$/i, "/");

  if (!cleanPath.startsWith("/")) cleanPath = "/" + cleanPath;
  if (!cleanPath.endsWith("/")) cleanPath += "/";
  return cleanPath;
}

function computeProjectCanonicalPath() {
  const projectSlug = extractProjectSlug(
    globalThis.location.pathname || "/",
    globalThis.location.search || ""
  );
  return projectSlug ? buildProjectDetailPath(projectSlug) : "";
}

function computeCanonicalUrl({ forceProd = false, cleanPath = null }) {
  const path = cleanPath || computeProjectCanonicalPath() || computeCleanPath();

  if (forceProd) {
    return `${BASE_URL}${path}`;
  }

  const isDirtyPath =
    /^\/pages\//i.test(globalThis.location.pathname) ||
    /\/index\.html$/i.test(globalThis.location.pathname);

  if (isDirtyPath || path !== computeCleanPath()) {
    return `${globalThis.location.origin}${path}`;
  }
  return globalThis.location.href.split("#")[0].split("?")[0];
}

function buildCanonicalLinks(options = {}) {
  const forceProd = options.forceProd ?? (!isLocalDevelopment() && !isPreviewEnvironment());
  const cleanPath = options.cleanPath || computeProjectCanonicalPath() || computeCleanPath();

  const canonical = computeCanonicalUrl({ forceProd, cleanPath });
  const origin = forceProd ? BASE_URL : globalThis.location.origin;

  const alternates = [
    { lang: "de", href: `${origin}${cleanPath}` },
    { lang: "en", href: `${origin}${cleanPath}` },
    { lang: "x-default", href: `${origin}${cleanPath}` },
  ];
  return { canonical, alternates, origin };
}

function upsertAlternateLanguageLink(lang, href) {
  if (!href) return;
  const selector = `link[rel="alternate"][hreflang="${lang}"]`;
  const existing = document.head.querySelector(selector);
  if (existing) return void existing.setAttribute("href", href);

  const el = document.createElement("link");
  el.setAttribute("rel", "alternate");
  el.setAttribute("hreflang", lang);
  el.setAttribute("href", href);
  document.head.appendChild(el);
}

export function applyCanonicalLinks(options = {}) {
  try {
    const { canonical, alternates } = buildCanonicalLinks(options);
    const canonicalEl = document.head.querySelector('link[rel="canonical"]');
    if (canonicalEl) {
      const currentHref = canonicalEl.getAttribute("href");
      if (currentHref !== canonical) {
        log.info("Updating canonical from", currentHref, "to", canonical);
        canonicalEl.setAttribute("href", canonical);
      }
      canonicalEl.removeAttribute("data-early");
    } else {
      log.warn("No static canonical tag found, injecting dynamically");
      upsertHeadLink({ rel: "canonical", href: canonical });
    }

    alternates.forEach(({ lang, href }) => upsertAlternateLanguageLink(lang, href));
    log.debug("Canonical links applied:", canonical);
  } catch (error) {
    log.error("Failed to apply canonical links:", error);
  }
}

// ============================================================================
// 2. CONTENT EXTRACTION
// ============================================================================

const WORD_SPLIT_PATTERN = /[\s,.;:/()[\]|!?-]+/;
const MAIN_HEADING_SELECTOR = "main h1, main h2, main h3";
const MAIN_IMAGE_ALT_SELECTOR = "main img[alt]";
const MAIN_VIDEO_TITLE_SELECTOR = "main iframe[title], main video[title], main video[aria-label]";

export function extractMainHeadingTexts(doc) {
  return uniqueList(
    Array.from(doc?.querySelectorAll?.(MAIN_HEADING_SELECTOR) || []).map(node => node.textContent)
  );
}

export function extractMainImageAltTexts(doc) {
  return uniqueList(
    Array.from(doc?.querySelectorAll?.(MAIN_IMAGE_ALT_SELECTOR) || []).map(node =>
      node.getAttribute("alt")
    )
  );
}

export function extractMainVideoTitles(doc) {
  return uniqueList(
    Array.from(doc?.querySelectorAll?.(MAIN_VIDEO_TITLE_SELECTOR) || []).map(
      node => node.getAttribute("title") || node.getAttribute("aria-label")
    )
  );
}

export function extractMainHeadingTerms(doc, options = {}) {
  const minTokenLength = Number(options.minTokenLength || 3);
  const maxTerms = Number(options.maxTerms || 20);
  const tokens = [...extractMainHeadingTexts(doc), ...extractMainImageAltTexts(doc)]
    .flatMap(value =>
      normalizeText(value)
        .split(WORD_SPLIT_PATTERN)
        .map(token => token.trim())
        .filter(token => token.length >= minTokenLength)
    )
    .filter(Boolean);

  return uniqueList(tokens).slice(0, maxTerms);
}
