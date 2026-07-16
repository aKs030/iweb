/**
 * Public entry for schema generation, canonical metadata, and resource hints.
 */

import { createLogger } from "../logger.js";
import { ENV } from "../../config/env.config.js";
import { FAVICON_512_URL } from "../../config/media-urls.js";
import {
  SITE_PERSON_DISAMBIGUATING_DESCRIPTION,
  SITE_WEBSITE_ALT_NAME,
  SITE_WEBSITE_DESCRIPTION,
  SITE_OWNER_NAME,
} from "../../config/site-seo.js";
import {
  applyCspNonce,
  scheduleIdleTask,
  normalizeSchemaText as normalizeText,
  uniqueSchemaList as uniqueList,
} from "../utils/index.js";
import {
  extractMainHeadingTexts,
  extractMainImageAltTexts,
  extractMainVideoTitles,
} from "./internal/document.js";

export { applyCanonicalLinks, extractMainHeadingTerms } from "./internal/document.js";
export { resourceHints } from "./internal/resource-hints.js";

const log = createLogger("SEO");

// ============================================================================
// 1. MEDIA ENRICHMENT
// ============================================================================

const DEFAULT_IMAGE_DIMENSIONS = Object.freeze({ width: 1200, height: 630 });

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

const PERSON_FALLBACK_ICON = FAVICON_512_URL;

function toAbsoluteUrl(url, base = ENV.BASE_URL) {
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

function inferImageDimensions(url, fallback = null) {
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

function buildImageObject({
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

function collectDomImageObjects({ doc, pageUrl, brandData, currentYear, canonicalOrigin }) {
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

function collectDomVideoObjects({ doc, pageUrl, pageData, brandData, canonicalOrigin }) {
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
// 2. PAGE CONFIGURATION
// ============================================================================

const SCHEMA_HOMEPAGE_DISCOVERY_TEXT =
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

function getSchemaSectionDiscoveryText(pathname = "/") {
  return getSchemaPageTypeConfig(pathname).discoveryText;
}

export function getSeoPageTopics(pathname = "/") {
  return [...getSchemaPageTypeConfig(pathname).seoTopics];
}

function buildSchemaKeywordList(pageData, pathname = "/") {
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

function getSchemaAboutTopics(pathname = "/") {
  return uniqueList(getSchemaPageTypeConfig(pathname).aboutTopics).map(name => ({
    "@type": "Thing",
    name,
  }));
}

function shouldIncludeSchemaSkillsList(pageUrl, baseUrl) {
  const normalizedBaseUrl = String(baseUrl || "").replace(/\/$/, "");
  const normalizedPageUrl = String(pageUrl || "").replace(/\/$/, "");
  return normalizedPageUrl === normalizedBaseUrl || normalizedPageUrl.endsWith("/about");
}

// ============================================================================
// 3. SCHEMA GENERATION AND INJECTION
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
