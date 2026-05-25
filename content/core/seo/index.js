/**
 * Centralized SEO & Schema.org Module
 * Consolidates CanonicalManager, ContentExtractors, ResourceHints, and Schema generators.
 * @author Abdulkerim Sesli
 * @version 7.0.0
 */

import { isLocalDevHost } from "../runtime-env.js";
import { BASE_URL } from "../../config/constants.js";
import { createLogger } from "../logger.js";
import { ENV } from "../../config/env.config.js";
import { FAVICON_512_URL } from "../../config/media-urls.js";
import {
  SITE_PERSON_DISAMBIGUATING_DESCRIPTION,
  SITE_WEBSITE_ALT_NAME,
  SITE_WEBSITE_DESCRIPTION,
  SITE_OWNER_NAME,
} from "../../config/site-seo.js";
import { buildProjectDetailPath, extractProjectSlug } from "../project-paths.js";
import {
  upsertHeadLink,
  applyCspNonce,
  scheduleIdleTask,
  normalizeSchemaText as normalizeText,
  uniqueSchemaList as uniqueList,
} from "../utils/index.js";

const log = createLogger("SEO");

// ============================================================================
// 1. CANONICAL MANAGER (formerly canonical-manager.js)
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
// 2. CONTENT EXTRACTORS (formerly content-extractors.js)
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

// ============================================================================
// 3. ADAPTIVE RESOURCE HINTS BUDGET (formerly resource-hints-matrix.js)
// ============================================================================

const DEFAULT_PREFETCH_EAGERNESS = "conservative";

const RESOURCE_HINT_ROUTE_MATRIX = Object.freeze({
  home: Object.freeze({
    seedRoutes: ["/projekte/", "/gallery/", "/videos/", "/blog/", "/about/"],
    maxRoutes: 6,
    maxPrefetch: 3,
    prerenderEnabled: true,
    prerenderEagerness: "moderate",
    prefetchEagerness: DEFAULT_PREFETCH_EAGERNESS,
    intentWarmupDelayMs: 75,
  }),
  blog: Object.freeze({
    seedRoutes: ["/", "/projekte/", "/videos/", "/about/"],
    maxRoutes: 4,
    maxPrefetch: 2,
    prerenderEnabled: true,
    prerenderEagerness: "conservative",
    prefetchEagerness: DEFAULT_PREFETCH_EAGERNESS,
    intentWarmupDelayMs: 65,
  }),
  videos: Object.freeze({
    seedRoutes: ["/", "/gallery/", "/blog/", "/about/"],
    maxRoutes: 4,
    maxPrefetch: 2,
    prerenderEnabled: true,
    prerenderEagerness: "conservative",
    prefetchEagerness: DEFAULT_PREFETCH_EAGERNESS,
    intentWarmupDelayMs: 65,
  }),
  gallery: Object.freeze({
    seedRoutes: ["/", "/videos/", "/blog/", "/about/"],
    maxRoutes: 4,
    maxPrefetch: 2,
    prerenderEnabled: true,
    prerenderEagerness: "conservative",
    prefetchEagerness: DEFAULT_PREFETCH_EAGERNESS,
    intentWarmupDelayMs: 65,
  }),
  projects: Object.freeze({
    seedRoutes: ["/", "/blog/", "/gallery/", "/videos/", "/about/"],
    maxRoutes: 5,
    maxPrefetch: 2,
    prerenderEnabled: true,
    prerenderEagerness: "conservative",
    prefetchEagerness: DEFAULT_PREFETCH_EAGERNESS,
    intentWarmupDelayMs: 65,
  }),
  about: Object.freeze({
    seedRoutes: ["/", "/projekte/", "/blog/", "/gallery/", "/videos/"],
    maxRoutes: 4,
    maxPrefetch: 2,
    prerenderEnabled: true,
    prerenderEagerness: "conservative",
    prefetchEagerness: DEFAULT_PREFETCH_EAGERNESS,
    intentWarmupDelayMs: 60,
  }),
  generic: Object.freeze({
    seedRoutes: ["/projekte/", "/gallery/", "/videos/", "/blog/", "/about/"],
    maxRoutes: 4,
    maxPrefetch: 2,
    prerenderEnabled: true,
    prerenderEagerness: "conservative",
    prefetchEagerness: DEFAULT_PREFETCH_EAGERNESS,
    intentWarmupDelayMs: 60,
  }),
});

function detectResourceHintRouteBucket(pathname = "/") {
  const path = String(pathname || "/").toLowerCase();
  if (path === "/" || path === "/index.html") return "home";
  if (path.startsWith("/blog")) return "blog";
  if (path.startsWith("/videos")) return "videos";
  if (path.startsWith("/gallery")) return "gallery";
  if (path.startsWith("/projekte")) return "projects";
  if (path.startsWith("/about")) return "about";
  return "generic";
}

export function getAdaptiveResourceHintBudget(options = {}) {
  const { pathname = "/", connection = null, deviceMemory = 0, hardwareConcurrency = 0 } = options;
  const bucket = detectResourceHintRouteBucket(pathname);
  const base = RESOURCE_HINT_ROUTE_MATRIX[bucket] || RESOURCE_HINT_ROUTE_MATRIX.generic;
  const saveData = Boolean(connection?.saveData);
  const effectiveType = String(connection?.effectiveType || "").toLowerCase();
  const memory = Number(deviceMemory || 0);
  const cores = Number(hardwareConcurrency || 0);

  const budget = {
    ...base,
    seedRoutes: [...base.seedRoutes],
  };

  if (
    saveData ||
    effectiveType.includes("2g") ||
    (memory > 0 && memory <= 2) ||
    (cores > 0 && cores <= 4)
  ) {
    budget.maxRoutes = Math.min(budget.maxRoutes, 3);
    budget.maxPrefetch = Math.min(budget.maxPrefetch, 2);
    budget.prerenderEnabled = false;
    budget.prerenderEagerness = "conservative";
    budget.intentWarmupDelayMs = Math.max(budget.intentWarmupDelayMs, 110);
    return budget;
  }

  if (effectiveType.includes("3g") || (memory > 0 && memory <= 4) || (cores > 0 && cores <= 8)) {
    budget.maxRoutes = Math.min(budget.maxRoutes, 4);
    budget.maxPrefetch = Math.min(budget.maxPrefetch, 2);
    budget.prerenderEagerness = "conservative";
    budget.intentWarmupDelayMs = Math.max(budget.intentWarmupDelayMs, 90);
    return budget;
  }
  return budget;
}

// ============================================================================
// 4. SCHEMA MEDIA & ENRICHMENT (formerly schema-media.js)
// ============================================================================

export const DEFAULT_IMAGE_DIMENSIONS = Object.freeze({ width: 1200, height: 630 });

const KNOWN_IMAGE_DIMENSIONS = Object.freeze({
  "favicon-512.webp": { width: 512, height: 512 },
  "og-home-800.png": { width: 800, height: 420 },
  "og-projekte-800.png": { width: 800, height: 420 },
  "og-videos-800.png": { width: 800, height: 420 },
  "og-design-800.png": { width: 800, height: 420 },
  "og-photography-800.png": { width: 800, height: 420 },
  "og-threejs-800.png": { width: 800, height: 420 },
  "og-react-800.png": { width: 800, height: 420 },
  "og-pwa-800.png": { width: 800, height: 420 },
  "og-seo-800.png": { width: 800, height: 420 },
  "og-performance-800.png": { width: 800, height: 420 },
  "og-webcomponents-800.png": { width: 800, height: 420 },
  "og-css-800.png": { width: 800, height: 420 },
  "og-typescript-800.png": { width: 800, height: 420 },
});

export const PERSON_FALLBACK_ICON = FAVICON_512_URL;

export function toAbsoluteUrl(url, base = ENV.BASE_URL) {
  if (!url) return "";
  try {
    return new URL(url, base).toString();
  } catch {
    return String(url);
  }
}

function getFilename(url) {
  try {
    const parsed = new URL(toAbsoluteUrl(url));
    return parsed.pathname.split("/").pop() || "";
  } catch {
    return "";
  }
}

function inferImageMimeType(url) {
  const filename = getFilename(url).toLowerCase();
  if (filename.endsWith(".svg")) return "image/svg+xml";
  if (filename.endsWith(".webp")) return "image/webp";
  if (filename.endsWith(".png")) return "image/png";
  if (filename.endsWith(".jpg") || filename.endsWith(".jpeg")) return "image/jpeg";
  if (filename.endsWith(".gif")) return "image/gif";
  if (filename.endsWith(".avif")) return "image/avif";
  return null;
}

export function inferImageDimensions(url, fallback = null) {
  const filename = getFilename(url);
  if (filename && KNOWN_IMAGE_DIMENSIONS[filename]) {
    return KNOWN_IMAGE_DIMENSIONS[filename];
  }
  return fallback;
}

function toInt(value) {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function extractYouTubeId(url) {
  try {
    const parsed = new URL(toAbsoluteUrl(url));
    const host = parsed.hostname.toLowerCase();
    if (host === "youtu.be") {
      return parsed.pathname.replace(/^\/+/, "").split("/")[0] || null;
    }
    if (host.includes("youtube.com") || host.includes("youtube-nocookie.com")) {
      if (parsed.pathname.startsWith("/embed/")) {
        return parsed.pathname.split("/")[2] || null;
      }
      return parsed.searchParams.get("v");
    }
  } catch {
    // ignore
  }
  return null;
}

export function buildImageObject({
  id,
  imageUrl,
  name,
  caption,
  creatorName,
  currentYear,
  dimensions,
  creditPrefix = "Photo: ",
  creditText = "",
  representativeOfPage = false,
}) {
  const absoluteUrl = toAbsoluteUrl(imageUrl);
  const encodingFormat = inferImageMimeType(absoluteUrl);

  const imageNode = {
    "@type": "ImageObject",
    ...(id ? { "@id": id } : {}),
    contentUrl: absoluteUrl,
    url: absoluteUrl,
    name: normalizeText(name || caption || ""),
    caption: normalizeText(caption || name || ""),
    creator: { "@type": "Person", name: creatorName },
    license: `${ENV.BASE_URL}/#image-license`,
    creditText: normalizeText(creditText || `${creditPrefix}${creatorName}`),
    copyrightNotice: `© ${currentYear} ${creatorName}`,
    acquireLicensePage: `${ENV.BASE_URL}/#image-license`,
  };

  if (encodingFormat) imageNode.encodingFormat = encodingFormat;
  const finalDimensions = dimensions || inferImageDimensions(absoluteUrl);
  if (finalDimensions?.width) imageNode.width = finalDimensions.width;
  if (finalDimensions?.height) imageNode.height = finalDimensions.height;
  if (representativeOfPage) imageNode.representativeOfPage = true;
  return imageNode;
}

export function collectDomImageObjects({ doc, pageUrl, brandData, currentYear, canonicalOrigin }) {
  const nodes = [];
  const seen = new Set();
  const images = Array.from(doc?.querySelectorAll?.("main img[src]") || []);

  for (const img of images) {
    if (nodes.length >= 12) break;
    const src = img.getAttribute("src") || img.src;
    if (!src) continue;

    const absolute = toAbsoluteUrl(src, canonicalOrigin);
    if (!absolute || seen.has(absolute)) continue;
    seen.add(absolute);

    const id = `${pageUrl}#image-${nodes.length + 1}`;
    const alt = normalizeText(img.getAttribute("alt") || "");
    const width = toInt(img.getAttribute("width"));
    const height = toInt(img.getAttribute("height"));

    nodes.push(
      buildImageObject({
        id,
        imageUrl: absolute,
        name: alt || pageUrl,
        caption: alt || pageUrl,
        creatorName: brandData.name,
        currentYear,
        dimensions: width && height ? { width, height } : undefined,
        creditPrefix: brandData.creditPrefix || "Photo: ",
      })
    );
  }
  return nodes;
}

export function collectDomVideoObjects({ doc, pageUrl, pageData, brandData, canonicalOrigin }) {
  const nodes = [];
  const seen = new Set();

  const iframeVideos = Array.from(doc?.querySelectorAll?.("main iframe[src]") || [])
    .filter(iframe => {
      const src = iframe.getAttribute("src") || iframe.src || "";
      return /youtube\.com|youtube-nocookie\.com|youtu\.be/i.test(src);
    })
    .slice(0, 8);

  for (const iframe of iframeVideos) {
    const src = iframe.getAttribute("src") || iframe.src || "";
    const absoluteEmbed = toAbsoluteUrl(src, canonicalOrigin);
    if (!absoluteEmbed || seen.has(absoluteEmbed)) continue;
    seen.add(absoluteEmbed);

    const youtubeId = extractYouTubeId(absoluteEmbed);
    const canonicalVideoUrl = youtubeId
      ? `https://www.youtube.com/watch?v=${youtubeId}`
      : absoluteEmbed;
    const name = normalizeText(
      iframe.getAttribute("title") ||
        iframe.getAttribute("aria-label") ||
        `${pageData?.title || "Video"} ${nodes.length + 1}`
    );

    const videoNode = {
      "@type": "VideoObject",
      "@id": `${pageUrl}#video-${nodes.length + 1}`,
      name,
      description: normalizeText(pageData?.description || name),
      url: canonicalVideoUrl,
      embedUrl: absoluteEmbed,
      inLanguage: "de-DE",
      isFamilyFriendly: true,
      publisher: {
        "@type": "Organization",
        name: brandData.legalName || brandData.name,
        url: ENV.BASE_URL,
      },
    };

    if (youtubeId) {
      videoNode.thumbnailUrl = `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`;
      videoNode.contentUrl = canonicalVideoUrl;
    }
    nodes.push(videoNode);
  }

  const htmlVideos = Array.from(doc?.querySelectorAll?.("main video") || []).slice(0, 8);
  for (const video of htmlVideos) {
    const directSrc =
      video.getAttribute("src") ||
      video.querySelector?.("source[src]")?.getAttribute?.("src") ||
      "";
    if (!directSrc) continue;

    const absoluteSrc = toAbsoluteUrl(directSrc, canonicalOrigin);
    if (!absoluteSrc || seen.has(absoluteSrc)) continue;
    seen.add(absoluteSrc);

    const name = normalizeText(
      video.getAttribute("title") ||
        video.getAttribute("aria-label") ||
        video.getAttribute("data-title") ||
        `${pageData?.title || "Video"} ${nodes.length + 1}`
    );

    const videoNode = {
      "@type": "VideoObject",
      "@id": `${pageUrl}#video-${nodes.length + 1}`,
      name,
      description: normalizeText(pageData?.description || name),
      url: absoluteSrc,
      contentUrl: absoluteSrc,
      inLanguage: "de-DE",
      isFamilyFriendly: true,
      publisher: {
        "@type": "Organization",
        name: brandData.legalName || brandData.name,
        url: ENV.BASE_URL,
      },
    };

    const poster = video.getAttribute("poster");
    if (poster) {
      videoNode.thumbnailUrl = toAbsoluteUrl(poster, canonicalOrigin);
    }
    nodes.push(videoNode);
  }
  return nodes;
}

// ============================================================================
// 5. SCHEMA PAGE CONFIG & TYPES (formerly schema-page-types.js)
// ============================================================================

export const SCHEMA_HOMEPAGE_DISCOVERY_TEXT =
  "Die Startseite bündelt Portfolio, Bildgalerie, Videoinhalte, Blogartikel und technische Schwerpunkte in einem zentralen Einstiegspunkt. Suchmaschinen und KI-Suchen erhalten dadurch einen klaren Überblick über Bilder, Videos und redaktionelle Inhalte auf dieser Domain.";

const SCHEMA_PAGE_TYPE_CONFIG = Object.freeze({
  home: Object.freeze({
    discoveryText:
      "Diese Hauptseite verweist auf alle zentralen Inhaltsbereiche: Blog, Galerie, Videos, Projekte und Profilinformationen.",
    schemaKeywords: ["Hauptseite", "Bildgalerie", "Video-Portfolio", "Tech Blog"],
    seoTopics: [
      "Hauptseite",
      "Portfolio Übersicht",
      "Bilder und Videos",
      "Blog Artikel",
      "Code Projekte",
    ],
    aboutTopics: ["Portfolio", "Webentwicklung", "Fotografie", "Video", "Blog"],
  }),
  blog: Object.freeze({
    discoveryText:
      "Der Blog enthält ausführliche Artikel mit technischen Erklärungen, strukturierten Überschriften, Bildern und ergänzenden Medien.",
    schemaKeywords: ["Blog", "Tutorials", "SEO", "Performance", "TypeScript"],
    seoTopics: ["Tech Blog", "Tutorial", "Performance", "SEO Inhalte", "Frontend Wissen"],
    aboutTopics: [
      "Portfolio",
      "Webentwicklung",
      "Fotografie",
      "Video",
      "Blog",
      "Technik Artikel",
      "SEO",
      "Performance",
    ],
  }),
  videos: Object.freeze({
    discoveryText:
      "Die Videoseite bündelt Video-Landingpages und eingebettete Inhalte mit beschreibenden Titeln und Vorschaubildern.",
    schemaKeywords: ["Video", "YouTube", "Behind the Scenes"],
    seoTopics: [
      "Video Inhalte",
      "YouTube Videos",
      "Short Clips",
      "Making-of",
      "Video Landingpages",
    ],
    aboutTopics: [
      "Portfolio",
      "Webentwicklung",
      "Fotografie",
      "Video",
      "Blog",
      "Videoinhalte",
      "YouTube",
    ],
  }),
  gallery: Object.freeze({
    discoveryText:
      "Die Galerie fokussiert auf visuelle Inhalte mit Bildmetadaten, Alt-Texten und strukturierter Bildzuordnung für die Suche.",
    schemaKeywords: ["Fotogalerie", "Urban Photography", "Portrait"],
    seoTopics: ["Bildgalerie", "Fotografie", "Portrait", "Street Photography", "Visuelle Serien"],
    aboutTopics: [
      "Portfolio",
      "Webentwicklung",
      "Fotografie",
      "Video",
      "Blog",
      "Bildersuche",
      "Bildmetadaten",
      "Fotogalerie",
    ],
  }),
  projects: Object.freeze({
    discoveryText:
      "Die Projektseite zeigt interaktive Frontend-Projekte mit inhaltlichen Beschreibungen, Kategorien und weiterführenden Verweisen.",
    schemaKeywords: ["Code Projekte", "Web Apps", "Frontend Experimente"],
    seoTopics: [
      "Code Projekte",
      "Web Apps",
      "Frontend Experimente",
      "JavaScript Projekte",
      "Interaktive Demos",
    ],
    aboutTopics: [
      "Portfolio",
      "Webentwicklung",
      "Fotografie",
      "Video",
      "Blog",
      "JavaScript Projekte",
      "Interaktive Web Apps",
    ],
  }),
  about: Object.freeze({
    discoveryText:
      "Die Profilseite beschreibt Abdulkerim Sesli als Autor der Inhalte und verknüpft die wichtigsten Themen dieser Website.",
    schemaKeywords: ["Profil", "Über Abdulkerim Sesli", "Autor"],
    seoTopics: ["Über Abdulkerim Sesli", "Profil", "Technischer Hintergrund", "Themenfelder"],
    aboutTopics: ["Portfolio", "Webentwicklung", "Fotografie", "Video", "Blog", "Autor", "Profil"],
  }),
  aiInfo: Object.freeze({
    discoveryText:
      "Die AI-Info-Seite bündelt Profil, Discovery-Dateien, strukturierte Daten und Kontaktpunkte für Suchsysteme, Agenten und andere KI-gestützte Clients.",
    schemaKeywords: ["AI Discovery", "LLM Index", "Strukturierte Daten", "Profil Hub"],
    seoTopics: [
      "AI Indexing",
      "LLM Discovery",
      "Strukturierte Daten",
      "Profil Hub",
      "API Discovery",
    ],
    aboutTopics: [
      "Portfolio",
      "Webentwicklung",
      "AI Discovery",
      "LLM Index",
      "Strukturierte Daten",
      "Profil",
    ],
  }),
  generic: Object.freeze({
    discoveryText:
      "Diese Seite ist Teil des Portfolios von Abdulkerim Sesli und ergänzt den Gesamtzusammenhang aus Text, Bild und Video.",
    schemaKeywords: ["Portfolio", "Webentwicklung", "Fotografie"],
    seoTopics: ["Portfolio", "Web", "Foto", "Video"],
    aboutTopics: ["Portfolio", "Webentwicklung", "Fotografie", "Video", "Blog"],
  }),
});

const BASE_SCHEMA_KEYWORDS = Object.freeze([
  "Abdulkerim Sesli",
  "Abdülkerim Sesli",
  "Abdul Sesli",
  "Portfolio",
  "Webentwicklung",
  "Fotografie",
  "Bilder",
  "Videos",
  "Google Bilder",
  "Google Videos",
  "KI Suche",
  "AI Integration",
  "Web Components",
  "Three.js",
  "JavaScript",
]);

const BASE_SEO_KEYWORDS = Object.freeze([
  "Abdulkerim Sesli",
  "Abdülkerim Sesli",
  "Abdul Sesli",
  "Portfolio",
  "Webentwicklung",
  "Fotografie",
  "Bilder",
  "Videos",
  "Blog",
  "Web Components",
  "Three.js",
  "JavaScript",
  "TypeScript",
  "AI Integration",
  "Performance Engineering",
  "Frontend",
  "UI",
  "SEO",
  "Google Bilder",
  "Google Videos",
  "KI Suche",
]);

const SCHEMA_TITLE_SPLIT_RE = /[\s|,–—:/]+/;
const SEO_TITLE_SPLIT_RE = /[\s,.;:/()[\]|!?-]+/;

function detectSchemaPageType(pathname = "/") {
  const path = String(pathname || "/").toLowerCase();
  if (path === "/" || path === "" || path === "/index.html") return "home";
  if (path.startsWith("/blog")) return "blog";
  if (path.startsWith("/videos")) return "videos";
  if (path.startsWith("/gallery")) return "gallery";
  if (path.startsWith("/projekte")) return "projects";
  if (path.startsWith("/about")) return "about";
  if (path.startsWith("/ai-info")) return "aiInfo";
  return "generic";
}

function getSchemaPageTypeConfig(pathname = "/") {
  const pageType = detectSchemaPageType(pathname);
  return SCHEMA_PAGE_TYPE_CONFIG[pageType] || SCHEMA_PAGE_TYPE_CONFIG.generic;
}

export function getSchemaSectionDiscoveryText(pathname = "/") {
  return getSchemaPageTypeConfig(pathname).discoveryText;
}

export function getSeoPageTopics(pathname = "/") {
  return [...getSchemaPageTypeConfig(pathname).seoTopics];
}

export function buildSchemaKeywordList(pageData, pathname = "/") {
  const config = getSchemaPageTypeConfig(pathname);
  const titleTokens = normalizeText(pageData?.title || "")
    .split(SCHEMA_TITLE_SPLIT_RE)
    .map(token => token.trim())
    .filter(token => token.length >= 3);

  return uniqueList([...BASE_SCHEMA_KEYWORDS, ...config.schemaKeywords, ...titleTokens]).slice(
    0,
    24
  );
}

export function buildSeoKeywordList(pageData, pathname = "/", extraKeywords = []) {
  const config = getSchemaPageTypeConfig(pathname);
  const titleTokens = normalizeText(pageData?.title || "")
    .split(SEO_TITLE_SPLIT_RE)
    .map(token => token.trim())
    .filter(token => token.length >= 3);

  return uniqueList([
    ...BASE_SEO_KEYWORDS,
    ...config.seoTopics,
    ...titleTokens,
    ...(Array.isArray(extraKeywords) ? extraKeywords : []),
  ]).slice(0, 40);
}

export function buildSeoAbstractText(pageData, pathname = "/") {
  const topics = getSeoPageTopics(pathname);
  return [
    pageData?.description || "",
    getSchemaSectionDiscoveryText(pathname),
    `Inhaltsschwerpunkte: ${topics.join(", ")}.`,
    "Diese Seite ist auf organische Suche für Bilder, Videos und redaktionelle Inhalte optimiert.",
  ]
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getSchemaAboutTopics(pathname = "/") {
  return uniqueList(getSchemaPageTypeConfig(pathname).aboutTopics).map(name => ({
    "@type": "Thing",
    name,
  }));
}

export function shouldIncludeSchemaSkillsList(pageUrl, baseUrl) {
  const normalizedBaseUrl = String(baseUrl || "").replace(/\/$/, "");
  const normalizedPageUrl = String(pageUrl || "").replace(/\/$/, "");
  return normalizedPageUrl === normalizedBaseUrl || normalizedPageUrl.endsWith("/about");
}

// ============================================================================
// 6. MAIN SCHEMA GENERATORS & DOM INJECTION (formerly schema.js)
// ============================================================================

const CRAWLER_UA_PATTERN =
  /googlebot|google-inspectiontool|bingbot|slurp|duckduckbot|baiduspider|yandex|facebookexternalhit|twitterbot|linkedinbot|applebot|semrushbot|ahrefsbot/i;

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function dedupeNodeRefList(refs) {
  const seen = new Set();
  return (refs || [])
    .filter(ref => {
      const id = normalizeText(ref?.["@id"]);
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .map(ref => ({ "@id": normalizeText(ref["@id"]) }));
}

function dedupeSchemaGraph(nodes) {
  const byId = new Map();
  const noIdNodes = [];
  const noIdSeen = new Set();

  for (const node of nodes || []) {
    if (!isPlainObject(node)) continue;
    const id = normalizeText(node["@id"]);
    if (id) {
      byId.set(id, node);
      continue;
    }
    const identity = JSON.stringify(node);
    if (noIdSeen.has(identity)) continue;
    noIdSeen.add(identity);
    noIdNodes.push(node);
  }
  return [...byId.values(), ...noIdNodes];
}

function extractSchemaNodesFromScript(script) {
  if (!script?.textContent) return [];
  try {
    const payload = JSON.parse(script.textContent);
    if (Array.isArray(payload?.["@graph"])) {
      return payload["@graph"].filter(isPlainObject);
    }
    if (isPlainObject(payload)) return [payload];
  } catch {
    // ignore
  }
  return [];
}

export function generateSchemaGraph(pageData, pageUrl, brandData, options = {}) {
  const { doc = document, forceProdCanonical = false } = options;
  const now = new Date();
  const currentYear = now.getFullYear();

  const canonicalOrigin =
    forceProdCanonical || doc?.documentElement?.dataset?.forceProdCanonical === "true"
      ? ENV.BASE_URL
      : globalThis.location?.origin || ENV.BASE_URL;

  const ID = {
    person: `${canonicalOrigin}/#person`,
    org: `${canonicalOrigin}/#organization`,
    website: `${canonicalOrigin}/#website`,
    webpage: `${pageUrl}#webpage`,
    breadcrumb: `${pageUrl}#breadcrumb`,
  };

  const graph = [];

  // Organization
  graph.push({
    "@type": "Organization",
    "@id": ID.org,
    name: brandData.legalName,
    url: ENV.BASE_URL,
    logo: createImageObject(brandData.logo, brandData.name, currentYear, canonicalOrigin),
    sameAs: brandData.sameAs,
    founder: { "@id": ID.person },
  });

  // Person
  const personNode = {
    "@type": ["Person", "Photographer"],
    "@id": ID.person,
    name: brandData.name,
    alternateName: brandData.alternateName,
    jobTitle: brandData.jobTitle,
    worksFor: { "@id": ID.org },
    url: ENV.BASE_URL,
    identifier: ID.person,
    logo: brandData.logo,
    image: brandData.image || {
      "@type": "ImageObject",
      "@id": `${ENV.BASE_URL}/#personImage`,
      contentUrl: PERSON_FALLBACK_ICON,
      url: PERSON_FALLBACK_ICON,
      width: 512,
      height: 512,
      creator: { "@type": "Person", name: brandData.name },
      caption: brandData.name,
      license: `${ENV.BASE_URL}/#image-license`,
      acquireLicensePage: `${ENV.BASE_URL}/#image-license`,
      creditText: `Photo: ${brandData.name}`,
      copyrightNotice: `© ${currentYear} ${brandData.name}`,
    },
    description: pageData.description,
    disambiguatingDescription: SITE_PERSON_DISAMBIGUATING_DESCRIPTION,
    sameAs: brandData.sameAs,
    knowsLanguage: brandData.knowsLanguage?.map(lang => ({
      "@type": "Language",
      name: lang.name,
      alternateName: lang.alternateName,
    })),
    knowsAbout: getKnowsAbout(),
  };

  enrichPersonNode(personNode, brandData, doc);
  graph.push(personNode);

  // WebPage
  const aiReadyText = extractPageContent(doc);
  const currentPathname = globalThis.location?.pathname || "/";
  const sectionDiscoveryText = getSchemaSectionDiscoveryText(currentPathname);
  const isHomepage = currentPathname === "/" || currentPathname === "";
  const pageKeywords = buildSchemaKeywordList(pageData, currentPathname);
  const longDescription = normalizeText(
    [pageData.description, sectionDiscoveryText, isHomepage ? SCHEMA_HOMEPAGE_DISCOVERY_TEXT : ""]
      .filter(Boolean)
      .join(" ")
  );
  const fullText = normalizeText(
    [aiReadyText, sectionDiscoveryText, isHomepage ? SCHEMA_HOMEPAGE_DISCOVERY_TEXT : ""]
      .filter(Boolean)
      .join(" ")
  );

  const webPageNode = {
    "@type": pageData.type || "WebPage",
    "@id": ID.webpage,
    url: pageUrl,
    name: pageData.title,
    description: longDescription || pageData.description,
    keywords: pageKeywords.join(", "),
    text: fullText,
    abstract: sectionDiscoveryText,
    about: getSchemaAboutTopics(currentPathname),
    mentions: pageKeywords.slice(0, 10).map(keyword => ({ "@type": "Thing", name: keyword })),
    isPartOf: { "@id": ID.website },
    mainEntity: { "@id": ID.person },
    publisher: { "@id": ID.org },
    inLanguage: "de-DE",
    dateModified:
      doc.querySelector('meta[name="dateModified"]')?.getAttribute("content") ||
      doc.querySelector('meta[property="article:modified_time"]')?.getAttribute("content") ||
      doc.querySelector('meta[name="dateCreated"]')?.getAttribute("content") ||
      now.toISOString(),
  };

  enrichWebPageNode(webPageNode, doc);
  graph.push(webPageNode);

  // WebSite
  graph.push({
    "@type": "WebSite",
    "@id": ID.website,
    url: ENV.BASE_URL,
    name: SITE_OWNER_NAME,
    alternateName: SITE_WEBSITE_ALT_NAME,
    description: SITE_WEBSITE_DESCRIPTION,
    keywords: pageKeywords.join(", "),
    inLanguage: "de-DE",
    publisher: { "@id": ID.org },
    potentialAction: {
      "@type": "SearchAction",
      target: `${ENV.BASE_URL}/?s={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  });

  if (shouldIncludeSchemaSkillsList(pageUrl, ENV.BASE_URL)) {
    graph.push(generateSkillsList(ENV.BASE_URL));
  }

  let primaryImageUrl = null;
  const hasPartRefs = [];
  if (pageData.image) {
    const imageNode = generateImageObject(
      pageUrl,
      pageData,
      brandData,
      currentYear,
      canonicalOrigin
    );
    primaryImageUrl = imageNode.url || imageNode.contentUrl || null;
    graph.push(imageNode);
    webPageNode.primaryImageOfPage = { "@id": imageNode["@id"] };
    if (primaryImageUrl) webPageNode.image = primaryImageUrl;
    if (imageNode["@id"]) hasPartRefs.push({ "@id": imageNode["@id"] });
  }

  const domImageNodes = collectDomImageObjects({
    doc,
    pageUrl,
    brandData,
    currentYear,
    canonicalOrigin,
  });
  if (domImageNodes.length > 0) {
    const filteredDomNodes = domImageNodes.filter(node => {
      const domUrl = node.url || node.contentUrl;
      return domUrl && domUrl !== primaryImageUrl;
    });
    if (filteredDomNodes.length > 0) {
      graph.push(...filteredDomNodes);
      for (const imageNode of filteredDomNodes) {
        if (imageNode["@id"]) hasPartRefs.push({ "@id": imageNode["@id"] });
      }
    }
    const imageUrls = [
      ...(webPageNode.image ? [webPageNode.image] : []),
      ...filteredDomNodes.map(node => node.url || node.contentUrl).filter(Boolean),
    ];
    if (imageUrls.length > 0) webPageNode.image = [...new Set(imageUrls)];
  }

  const domVideoNodes = collectDomVideoObjects({
    doc,
    pageUrl,
    pageData,
    brandData,
    canonicalOrigin,
  });
  if (domVideoNodes.length > 0) {
    graph.push(...domVideoNodes);
    webPageNode.video = domVideoNodes.map(node => ({ "@id": node["@id"] }));
    for (const videoNode of domVideoNodes) {
      if (videoNode["@id"]) hasPartRefs.push({ "@id": videoNode["@id"] });
    }
  }

  if (hasPartRefs.length > 0) {
    webPageNode.hasPart = dedupeNodeRefList(hasPartRefs);
  }

  const faqNodes = extractFAQs(pageUrl, doc);
  if (faqNodes.length > 0) {
    graph.push({
      "@type": "FAQPage",
      "@id": `${pageUrl}#faq`,
      name: pageData?.title ? `${pageData.title} — FAQ` : "Häufig gestellte Fragen",
      mainEntity: faqNodes,
      isPartOf: { "@id": ID.webpage },
    });
  }

  graph.push(generateBreadcrumbs(pageUrl, pageData.title, canonicalOrigin));
  return dedupeSchemaGraph(graph);
}

function createImageObject(url, name, currentYear, canonicalOrigin = ENV.BASE_URL) {
  return buildImageObject({
    id: toAbsoluteUrl(url, canonicalOrigin),
    imageUrl: toAbsoluteUrl(url, canonicalOrigin),
    name: `${name} Logo`,
    caption: `${name} Logo`,
    creatorName: name,
    currentYear,
    dimensions: { width: 512, height: 512 },
    creditPrefix: "Logo: ",
  });
}

function getKnowsAbout() {
  return [
    { "@type": "Thing", name: "Web Development", sameAs: "https://www.wikidata.org/wiki/Q386275" },
    { "@type": "Thing", name: "React", sameAs: "https://www.wikidata.org/wiki/Q19399674" },
    { "@type": "Thing", name: "Three.js", sameAs: "https://www.wikidata.org/wiki/Q28135934" },
    { "@type": "Thing", name: "JavaScript", sameAs: "https://www.wikidata.org/wiki/Q28865" },
    { "@type": "Thing", name: "Photography", sameAs: "https://www.wikidata.org/wiki/Q11633" },
  ];
}

function generateBreadcrumbs(pageUrl, pageTitle, canonicalOrigin) {
  const segments = (globalThis.location?.pathname || "/")
    .replace(/\/$/, "")
    .split("/")
    .filter(Boolean);
  const crumbs = [
    {
      "@type": "ListItem",
      position: 1,
      name: "Home",
      item: { "@id": canonicalOrigin || ENV.BASE_URL, name: "Home" },
    },
  ];

  let pathAcc = canonicalOrigin || ENV.BASE_URL;
  segments.forEach((seg, i) => {
    pathAcc += `/${seg}`;
    const name = seg.charAt(0).toUpperCase() + seg.slice(1);
    crumbs.push({
      "@type": "ListItem",
      position: i + 2,
      name,
      item: { "@id": pathAcc, name },
    });
  });

  return {
    "@type": "BreadcrumbList",
    "@id": `${pageUrl}#breadcrumb`,
    name: pageTitle || "Navigationspfad",
    itemListElement: crumbs,
  };
}

function enrichPersonNode(personNode, brandData, doc) {
  try {
    const postsCount = Number(brandData.postsCount) || 0;
    const articlesCount = doc?.querySelectorAll?.("article")?.length || 0;
    const writeCount = postsCount > 0 ? postsCount : articlesCount;
    if (writeCount > 0) {
      personNode.agentInteractionStatistic = {
        "@type": "InteractionCounter",
        interactionType: "https://schema.org/WriteAction",
        userInteractionCount: writeCount,
      };
    }

    const followers = Number(brandData.followersCount) || 0;
    const likes = Number(brandData.likesCount) || 0;
    if (followers > 0 || likes > 0) {
      personNode.interactionStatistic = [];
      if (followers > 0) {
        personNode.interactionStatistic.push({
          "@type": "InteractionCounter",
          interactionType: "https://schema.org/FollowAction",
          userInteractionCount: followers,
        });
      }
      if (likes > 0) {
        personNode.interactionStatistic.push({
          "@type": "InteractionCounter",
          interactionType: "https://schema.org/LikeAction",
          userInteractionCount: likes,
        });
      }
    }
  } catch {
    // ignore
  }
}

function enrichWebPageNode(webPageNode, doc) {
  try {
    const metaPub =
      doc?.head?.querySelector?.(
        'meta[property="article:published_time"], meta[name="dateCreated"], meta[property="og:published_time"]'
      ) || null;
    const timeEl =
      doc?.querySelector?.(
        'time[datetime][pubdate], time[datetime][itemprop="dateCreated"], time[datetime][data-created]'
      ) || null;
    const created =
      metaPub?.getAttribute?.("content") || timeEl?.getAttribute?.("datetime") || null;
    if (created) {
      try {
        webPageNode.dateCreated = new Date(created).toISOString();
      } catch {
        webPageNode.dateCreated = created;
      }
    }
  } catch {
    // ignore
  }
}

function extractPageContent(doc) {
  try {
    const contentNode =
      doc?.querySelector?.("main") || doc?.querySelector?.("article") || doc?.body;
    if (!contentNode) return "";

    const clone = contentNode.cloneNode(true);
    const noiseSelectors = [
      "nav",
      "footer",
      "script",
      "style",
      "noscript",
      "iframe",
      ".cookie-banner",
      ".no-ai",
      '[aria-hidden="true"]',
    ];
    noiseSelectors.forEach(sel => clone.querySelectorAll?.(sel).forEach(el => el.remove()));

    let text = clone.textContent || "";
    text = text.replace(/\s+/g, " ").trim();

    const imageAltTexts = uniqueList(extractMainImageAltTexts(doc));
    const videoTitles = uniqueList(extractMainVideoTitles(doc));
    if (imageAltTexts.length > 0) text += ` Bilder: ${imageAltTexts.slice(0, 12).join(" | ")}.`;
    if (videoTitles.length > 0) text += ` Videos: ${videoTitles.slice(0, 10).join(" | ")}.`;

    const headingTexts = uniqueList(extractMainHeadingTexts(doc));
    if (headingTexts.length > 0) text += ` Themen: ${headingTexts.slice(0, 12).join(" | ")}.`;
    return text.length > 5000 ? text.substring(0, 5000) + "..." : text;
  } catch {
    return "";
  }
}

function generateSkillsList(baseUrl) {
  return {
    "@type": "ItemList",
    "@id": `${baseUrl}/#skills`,
    name: "Technische Skills & Kompetenzen",
    description: "Kernkompetenzen in der Fullstack-Webentwicklung und Fotografie",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "React & Next.js Ecosystem" },
      { "@type": "ListItem", position: 2, name: "Three.js & WebGL 3D-Visualisierung" },
      { "@type": "ListItem", position: 3, name: "Node.js & Backend Architecture" },
      { "@type": "ListItem", position: 4, name: "UI/UX Design & Animation" },
      { "@type": "ListItem", position: 5, name: "Urban & Portrait Photography" },
    ],
  };
}

function generateImageObject(
  pageUrl,
  pageData,
  brandData,
  currentYear,
  canonicalOrigin = ENV.BASE_URL
) {
  const absoluteImage = toAbsoluteUrl(pageData.image, canonicalOrigin);
  const dimensions = inferImageDimensions(absoluteImage, DEFAULT_IMAGE_DIMENSIONS);

  return buildImageObject({
    id: `${pageUrl}#primaryImage`,
    imageUrl: absoluteImage,
    name: pageData.title || pageData.description || "",
    caption: pageData.title || pageData.description || "",
    creatorName: brandData.name,
    currentYear,
    dimensions,
    creditPrefix: brandData.creditPrefix || "Photo: ",
    creditText: pageData.imageCredit || "",
    representativeOfPage: true,
  });
}

function extractFAQs(pageUrl, doc) {
  return Array.from(doc?.querySelectorAll?.(".faq-item") || [])
    .map((el, i) => {
      const rawQ = el.querySelector?.(".question, h3, summary")?.textContent;
      const rawA = el.querySelector?.(".answer, p, div")?.textContent;
      const q = rawQ ? String(rawQ).replace(/\s+/g, " ").trim() : "";
      const a = rawA ? String(rawA).replace(/\s+/g, " ").trim() : "";
      if (!q || q.length < 2) return null;
      return {
        "@type": "Question",
        "@id": `${pageUrl}#faq-q${i + 1}`,
        name: q,
        acceptedAnswer: { "@type": "Answer", text: a || "Details ansehen" },
      };
    })
    .filter(Boolean);
}

export function injectSchema(graph, options = {}) {
  const { doc = document, scriptId = "schema-ldjson" } = options;
  if (!doc?.head || !Array.isArray(graph) || graph.length === 0) return;

  try {
    const edgeScript = doc.getElementById("edge-route-schema");
    const edgeNodes = extractSchemaNodesFromScript(edgeScript);
    const finalGraph = dedupeSchemaGraph([...(edgeNodes || []), ...(graph || [])]);

    let script = doc.getElementById(scriptId);
    const payload = JSON.stringify(
      { "@context": "https://schema.org", "@graph": finalGraph },
      null,
      2
    );

    if (script) {
      applyCspNonce(script);
      script.textContent = payload;
    } else {
      script = doc.createElement("script");
      script.type = "application/ld+json";
      script.id = scriptId;
      applyCspNonce(script);
      script.textContent = payload;
      doc.head.appendChild(script);
    }
    if (edgeScript && edgeScript.id !== scriptId) edgeScript.remove();
    log.debug("Schema injected successfully");
  } catch (error) {
    log.error("Failed to inject schema:", error);
  }
}

export function scheduleSchemaInjection(callback) {
  const run = () => {
    try {
      callback();
    } catch (error) {
      log.error("Scheduled schema injection failed:", error);
    }
  };

  const userAgent = globalThis.navigator?.userAgent || "";
  if (CRAWLER_UA_PATTERN.test(userAgent)) {
    if (typeof queueMicrotask === "function") {
      queueMicrotask(run);
    } else {
      Promise.resolve().then(run);
    }
    return;
  }
  scheduleIdleTask(run, { timeout: 600, fallbackDelay: 150 });
}

// ============================================================================
// 7. DYNAMIC RESOURCE HINTS (formerly resource-hints.js)
// ============================================================================

const ELEMENT_HINT_SELECTOR =
  'link[rel="prefetch"], link[rel="prerender"], script[type="speculationrules"]';
const SPECULATION_RULES_SELECTOR =
  'script[type="speculationrules"][data-injected-by="resource-hints"]';
const DOWNLOAD_FILE_RE =
  /\.(pdf|zip|rar|7z|tar|gz|mp4|webm|mov|mp3|wav|doc|docx|xls|xlsx|ppt|pptx)$/i;

class ResourceHintsManager {
  constructor() {
    this.hints = new Map();
    this.resetRuntimeState();
  }

  resetRuntimeState() {
    this.initialized = false;
    this.speculationRefreshAttached = false;
    this.intentHandlersAttached = false;
    this.intentHandler = null;
    this.intentWarmupTimer = null;
    this.intentPrefetchedRoutes = new Set();
    this._cachedProfile = null;
    this._cachedProfilePathname = null;
    // IntersectionObserver-based prefetch state
    this.intersectionObserver = null;
    this.intersectionPrefetchedRoutes = new Set();
  }

  registerLinkHint(config) {
    const { key, linkOptions, hintMeta, successMessage, failureMessage } = config;
    if (!key || this.hints.has(key)) return false;

    try {
      upsertHeadLink({
        ...(linkOptions || {}),
        dataset: {
          injectedBy: "resource-hints",
          ...(linkOptions?.dataset || {}),
        },
      });
      this.hints.set(key, hintMeta);
      log.info(successMessage);
      return true;
    } catch (err) {
      log.error(failureMessage, err);
      return false;
    }
  }

  resolveEligibleRoute(rawHref) {
    const href = String(rawHref || "").trim();
    if (!href || href.startsWith("#")) return null;
    if (href.startsWith("mailto:") || href.startsWith("tel:")) return null;

    try {
      const url = new URL(href, globalThis.location.href);
      if (url.origin !== globalThis.location.origin) return null;
      if (url.search) return null;
      if (!this.isEligibleSpeculativePath(url.pathname)) return null;
      return this.toRoutePath(url.pathname);
    } catch {
      return null;
    }
  }

  trackSpeculationHint(routes, rules) {
    this.hints.set("speculationrules", {
      type: "speculationrules",
      routes: [...routes],
      prerenderEnabled: Boolean(rules.prerender?.length),
      eagerness: rules.prerender?.[0]?.eagerness || "conservative",
    });
  }

  clearIntentWarmupTimer() {
    if (!this.intentWarmupTimer) return;
    clearTimeout(this.intentWarmupTimer);
    this.intentWarmupTimer = null;
  }

  getNetworkConnection() {
    const nav = /** @type {any} */ (globalThis.navigator);
    return nav?.connection || nav?.mozConnection || nav?.webkitConnection || null;
  }

  dnsPrefetch(origin) {
    this.registerLinkHint({
      key: `dns-prefetch:${origin}`,
      linkOptions: { rel: "dns-prefetch", href: origin },
      hintMeta: { type: "dns-prefetch", origin },
      successMessage: `DNS prefetch added: ${origin}`,
      failureMessage: `Failed to add DNS prefetch for ${origin}:`,
    });
  }

  prefetch(href, options = {}) {
    const { as = "document" } = options;
    this.registerLinkHint({
      key: `prefetch:${href}`,
      linkOptions: { rel: "prefetch", href, as },
      hintMeta: { type: "prefetch", href, as },
      successMessage: `Prefetch added: ${href}`,
      failureMessage: `Failed to add prefetch for ${href}:`,
    });
  }

  modulePreload(href) {
    this.registerLinkHint({
      key: `modulepreload:${href}`,
      linkOptions: {
        rel: "modulepreload",
        href,
        crossOrigin: "anonymous",
      },
      hintMeta: { type: "modulepreload", href },
      successMessage: `Module preload added: ${href}`,
      failureMessage: `Failed to add modulepreload for ${href}:`,
    });
  }

  normalizePath(pathname) {
    const raw = String(pathname || "").trim();
    if (!raw || raw === "/index.html") return "/";

    const withLeadingSlash = raw.startsWith("/") ? raw : `/${raw}`;
    return withLeadingSlash.replace(/\/{2,}/g, "/");
  }

  toRoutePath(pathname) {
    const normalized = this.normalizePath(pathname);
    if (normalized === "/") return "/";
    return normalized.endsWith("/") ? normalized : `${normalized}/`;
  }

  isSpeculationDisabled() {
    try {
      if (globalThis.__DISABLE_SPECULATION__ === true) return true;

      const params = new URLSearchParams(globalThis.location?.search || "");
      if (params.get("speculation") === "off") return true;
    } catch {
      // Ignore environments where location is unavailable
    }

    return false;
  }

  shouldUseSpeculativeLoading() {
    try {
      const connection = this.getNetworkConnection();

      if (!connection) return true;
      if (connection.saveData) return false;

      const effectiveType = String(connection.effectiveType || "").toLowerCase();
      return !effectiveType.includes("2g");
    } catch {
      return true;
    }
  }

  getSpeculationProfile() {
    const currentPathname = globalThis.location?.pathname || "/";

    if (this._cachedProfile && this._cachedProfilePathname === currentPathname) {
      return this._cachedProfile;
    }

    this._cachedProfilePathname = currentPathname;
    const nav = /** @type {any} */ (globalThis.navigator);
    this._cachedProfile = getAdaptiveResourceHintBudget({
      pathname: currentPathname,
      connection: this.getNetworkConnection(),
      deviceMemory: Number(nav?.deviceMemory || 0),
      hardwareConcurrency: Number(nav?.hardwareConcurrency || 0),
    });

    return this._cachedProfile;
  }

  isEligibleSpeculativePath(pathname) {
    const normalized = this.normalizePath(pathname);
    const current = this.normalizePath(globalThis.location?.pathname || "/");

    if (!normalized || normalized === "/" || normalized === current) return false;
    if (normalized.startsWith("/api/") || normalized.startsWith("/functions/")) {
      return false;
    }
    if (DOWNLOAD_FILE_RE.test(normalized)) return false;

    // Keep speculative route list focused on high-level destinations
    const segments = normalized.split("/").filter(Boolean);
    if (segments.length > 1) return false;

    return true;
  }

  collectRoutesFromDom() {
    const selectors = [
      { selector: ".site-menu a[href]", weight: 6 },
      { selector: "header a[href]", weight: 4 },
      { selector: "main a[href]", weight: 2 },
      { selector: "a[href]", weight: 1 },
    ];
    const routeScores = new Map();
    const origin = globalThis.location?.origin || "";

    selectors.forEach(({ selector, weight }) => {
      document.querySelectorAll(selector).forEach(anchor => {
        if (!(anchor instanceof HTMLAnchorElement)) return;
        if (anchor.hasAttribute("download")) return;
        const route = this.resolveEligibleRoute(anchor.getAttribute("href"));
        if (!route) return;
        const url = new URL(route, globalThis.location.href);
        if (url.origin !== origin) return;
        const score = routeScores.get(route) || 0;
        routeScores.set(route, score + weight);
      });
    });

    return Array.from(routeScores.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([route]) => route)
      .slice(0, this.getSpeculationProfile().maxRoutes);
  }

  getSpeculativeRoutes(seedRoutes = this.getSpeculationProfile().seedRoutes) {
    const merged = [...seedRoutes, ...this.collectRoutesFromDom()];
    const uniqueRoutes = [];
    const seen = new Set();
    const profile = this.getSpeculationProfile();

    merged.forEach(path => {
      if (!this.isEligibleSpeculativePath(path)) return;
      const route = this.toRoutePath(path);
      if (seen.has(route)) return;
      seen.add(route);
      uniqueRoutes.push(route);
    });

    return uniqueRoutes.slice(0, profile.maxRoutes);
  }

  getPrefetchRoutes(routes) {
    return routes.slice(0, this.getSpeculationProfile().maxPrefetch);
  }

  createSpeculationRules(routes) {
    const profile = this.getSpeculationProfile();
    const prefetchRoutes = this.getPrefetchRoutes(routes);
    const rules = {
      prefetch: [
        {
          source: "list",
          urls: prefetchRoutes,
          eagerness: profile.prefetchEagerness,
        },
      ],
    };

    if (profile.prerenderEnabled) {
      rules.prerender = [
        {
          source: "document",
          where: {
            and: [
              { href_matches: "/*" },
              { not: { href_matches: "/api/*" } },
              { not: { href_matches: "/functions/*" } },
              {
                not: {
                  selector_matches:
                    'a[download],a[href^="#"],a[href*="?"],a[target="_blank"],a[href$=".pdf"],a[href$=".zip"],a[href$=".mp4"],a[data-no-speculate],a[data-no-prerender]',
                },
              },
            ],
          },
          eagerness: profile.prerenderEagerness,
        },
      ];
    }

    return rules;
  }

  supportsSpeculationRules() {
    return Boolean(HTMLScriptElement.supports && HTMLScriptElement.supports("speculationrules"));
  }

  trackSpeculationActivation() {
    try {
      const [navigationEntry] = performance.getEntriesByType("navigation");
      if (!navigationEntry) return;

      const navEntry = /** @type {any} */ (navigationEntry);
      const activationStart = Number(navEntry.activationStart || 0);
      if (activationStart <= 0) return;

      performance.mark("speculation-prerender-activated");

      const detail = {
        activated: true,
        activationStart: Math.round(activationStart),
        path: this.normalizePath(globalThis.location?.pathname || "/"),
        type: navEntry.type || "navigate",
      };

      log.info("Prerender activation detected", detail);

      globalThis.dispatchEvent(new CustomEvent("speculation:activation", { detail }));
    } catch (err) {
      log.debug("Speculation activation tracking unavailable", err);
    }
  }

  initPrefetchFallback(routes = this.getSpeculationProfile().seedRoutes) {
    const speculativeRoutes = this.getPrefetchRoutes(this.getSpeculativeRoutes(routes));
    speculativeRoutes.forEach(href => this.prefetch(href, { as: "document" }));
    log.info(`Prefetch fallback initialized (${speculativeRoutes.length} routes)`);
  }

  updateInjectedSpeculationRules(routes) {
    const rules = this.createSpeculationRules(routes);
    const script = document.querySelector(SPECULATION_RULES_SELECTOR);
    if (!script) return false;

    const replacement = document.createElement("script");
    replacement.type = "speculationrules";
    replacement.dataset.injectedBy = "resource-hints";
    applyCspNonce(replacement);
    replacement.textContent = JSON.stringify(rules);
    script.replaceWith(replacement);

    this.trackSpeculationHint(routes, rules);
    log.info(`Speculation Rules updated (${routes.length} routes)`);
    return true;
  }

  getIntentRouteFromAnchor(anchor) {
    if (!anchor) return null;
    if (anchor.hasAttribute("download")) return null;
    if (anchor.target === "_blank") return null;
    if (anchor.dataset?.noSpeculate === "true") return null;
    if (anchor.dataset?.noPrerender === "true") return null;

    return this.resolveEligibleRoute(anchor.getAttribute("href"));
  }

  promoteIntentRoute(route) {
    if (!route) return;

    const prioritizedRoutes = [
      route,
      ...this.getSpeculativeRoutes().filter(item => item !== route),
    ].slice(0, this.getSpeculationProfile().maxRoutes);

    if (this.supportsSpeculationRules()) {
      if (this.updateInjectedSpeculationRules(prioritizedRoutes)) {
        return;
      }
    }

    this.prefetch(route, { as: "document" });
  }

  attachIntentPreloading() {
    if (this.intentHandlersAttached) return;
    this.intentHandlersAttached = true;

    this.intentHandler = event => {
      const target = event?.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(target instanceof HTMLAnchorElement)) return;

      const route = this.getIntentRouteFromAnchor(target);
      if (!route) return;

      if (event.type === "pointerover") {
        if (this.intentPrefetchedRoutes.has(route)) return;
        this.clearIntentWarmupTimer();
        this.intentWarmupTimer = setTimeout(() => {
          this.intentPrefetchedRoutes.add(route);
          this.prefetch(route, { as: "document" });
          this.intentWarmupTimer = null;
        }, this.getSpeculationProfile().intentWarmupDelayMs);
        return;
      }

      this.clearIntentWarmupTimer();
      this.promoteIntentRoute(route);
    };

    document.addEventListener("pointerover", this.intentHandler, {
      passive: true,
    });
    document.addEventListener("pointerdown", this.intentHandler, {
      passive: true,
    });
  }

  initSpeculativeRules(routes = this.getSpeculationProfile().seedRoutes) {
    try {
      const speculativeRoutes = this.getSpeculativeRoutes(routes);
      if (!this.supportsSpeculationRules()) {
        log.info("Speculative Rules API not supported by browser");
        return false;
      }

      if (this.updateInjectedSpeculationRules(speculativeRoutes)) {
        return true;
      }

      if (document.querySelector('script[type="speculationrules"]')) {
        log.info("Speculation Rules already present (external script), skipping manager injection");
        return true;
      }

      const script = document.createElement("script");
      script.type = "speculationrules";
      script.dataset.injectedBy = "resource-hints";
      applyCspNonce(script);

      const rules = this.createSpeculationRules(speculativeRoutes);

      script.textContent = JSON.stringify(rules);
      document.head.appendChild(script);
      this.trackSpeculationHint(speculativeRoutes, rules);
      log.info(
        `Speculation Rules injected (${speculativeRoutes.length} routes, prerender=${Boolean(rules.prerender?.length)})`
      );
      return true;
    } catch (err) {
      log.error("Failed to initialize speculative rules:", err);
      return false;
    }
  }

  initSpeculativeNavigation() {
    if (this.isSpeculationDisabled()) {
      log.info("Speculative navigation disabled via runtime flag");
      return;
    }

    if (!this.shouldUseSpeculativeLoading()) {
      log.info("Skipping speculative navigation due to Save-Data or slow connection");
      return;
    }

    const profile = this.getSpeculationProfile();
    log.info("Speculation profile", profile);

    const initializedWithSpeculation = this.initSpeculativeRules();
    if (!initializedWithSpeculation) {
      this.initPrefetchFallback();
    }

    this.attachIntentPreloading();
    this.attachIntersectionPrefetch();
    this.attachSpeculationRefresh();
  }

  attachSpeculationRefresh() {
    if (this.speculationRefreshAttached) return;
    this.speculationRefreshAttached = true;

    const refresh = () => {
      if (!this.initialized) return;
      if (this.isSpeculationDisabled()) return;
      if (!this.shouldUseSpeculativeLoading()) return;

      if (this.supportsSpeculationRules()) {
        this.initSpeculativeRules();
      } else {
        this.initPrefetchFallback();
      }
    };

    document.addEventListener("menu:loaded", refresh, { once: true });
    scheduleIdleTask(refresh, {
      timeout: 2200,
      fallbackDelay: 1200,
    });
  }

  attachIntersectionPrefetch() {
    if (this.intersectionObserver) return;
    if (typeof IntersectionObserver === "undefined") return;
    if (!this.shouldUseSpeculativeLoading()) return;

    const VIEWPORT_MARGIN = "0px 0px 150px 0px";

    this.intersectionObserver = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const anchor = entry.target;
          if (!(anchor instanceof HTMLAnchorElement)) continue;

          const route = this.getIntentRouteFromAnchor(anchor);
          if (!route) continue;
          if (this.intersectionPrefetchedRoutes.has(route)) continue;
          if (this.intentPrefetchedRoutes.has(route)) continue;

          this.intersectionPrefetchedRoutes.add(route);
          this.prefetch(route, { as: "document" });
          log.debug(`IntersectionObserver prefetch: ${route}`);

          this.intersectionObserver?.unobserve(anchor);
        }
      },
      { rootMargin: VIEWPORT_MARGIN, threshold: 0 }
    );

    this._observeEligibleLinks();

    document.addEventListener("menu:loaded", () => this._observeEligibleLinks(), { once: true });
  }

  _observeEligibleLinks() {
    if (!this.intersectionObserver) return;
    document.querySelectorAll("a[href]").forEach(el => {
      if (!(el instanceof HTMLAnchorElement)) return;
      const route = this.resolveEligibleRoute(el.getAttribute("href"));
      if (!route) return;
      if (this.intersectionPrefetchedRoutes.has(route)) return;
      this.intersectionObserver.observe(el);
    });
  }

  initCommonHints() {
    if (this.initialized) return;

    this.trackSpeculationActivation();
    this.initSpeculativeNavigation();

    this.initialized = true;
    log.info("Common resource hints initialized");
  }

  clearAllHints() {
    if (typeof document === "undefined") return;
    document.querySelectorAll(ELEMENT_HINT_SELECTOR).forEach(el => el.remove());
    this.hints.clear();
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
    }
  }
}

let instance = null;

function getResourceHintsManager() {
  if (!instance) {
    instance = new ResourceHintsManager();
  }
  return instance;
}

export const resourceHints = {
  dnsPrefetch: origin => getResourceHintsManager().dnsPrefetch(origin),
  prefetch: (href, options) => getResourceHintsManager().prefetch(href, options),
  modulePreload: href => getResourceHintsManager().modulePreload(href),
  init: () => getResourceHintsManager().initCommonHints(),
  clearAllHints: () => getResourceHintsManager().clearAllHints(),
};
