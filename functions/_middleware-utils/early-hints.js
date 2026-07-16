/**
 * Link-Header Preload Utilities
 *
 * Sends CSS, JS, and preconnect hints as HTTP Link headers
 * so the browser can start fetching resources while still receiving
 * the HTML response body — improving FCP by eliminating idle time.
 *
 * @version 1.0.0
 */

import { R2_PUBLIC_ORIGIN } from "../../content/config/media-urls.js";

// ---------------------------------------------------------------------------
// Core resources to signal via Link headers
// ---------------------------------------------------------------------------

/**
 * Resources the browser should start fetching immediately on header receipt.
 * Order matters — CSS first (render-blocking), then modulepreload (parser hint).
 */
import { normalizePathname } from "../../content/core/utils/index.js";
import { DEPLOY_VERSION } from "./template-cache.js";

const v = DEPLOY_VERSION ? `?v=${DEPLOY_VERSION}` : "";
const withVersion = href => (href.startsWith("/") ? `${href}${v}` : href);

const CORE_RESOURCES = [
  // Core CSS is loaded immediately by the document head
  { href: `/content/styles/foundation.css${v}`, rel: "preload", as: "style" },
  { href: `/content/styles/main.css${v}`, rel: "preload", as: "style" },

  // Core JS modules — start parsing before HTML fully loaded
  { href: `/content/main.js${v}`, rel: "modulepreload" },
  { href: `/content/components/head/index.js${v}`, rel: "modulepreload" },
  { href: `/content/components/menu/index.js${v}`, rel: "modulepreload" },

  // Third-party preconnect — start DNS + TLS handshake early
  { href: "https://cdn.jsdelivr.net", rel: "preconnect", crossorigin: true },
  { href: "https://esm.sh", rel: "preconnect", crossorigin: true },
  {
    href: R2_PUBLIC_ORIGIN,
    rel: "preconnect",
    crossorigin: true,
  },
];

const SHARED_ROUTE_STYLES = [
  "/content/components/interactions/interactions.css",
  "/content/styles/pages/common.css",
];

const ROUTE_STYLE_RESOURCES = new Map([
  [
    "/",
    [
      ...SHARED_ROUTE_STYLES,
      "/content/styles/pages/home.css",
      "/content/components/particles/three-earth.css",
      "/content/components/typewriter/typewriter.css",
    ],
  ],
  ["/videos", [...SHARED_ROUTE_STYLES, "/content/styles/pages/videos.css"]],
  ["/blog", [...SHARED_ROUTE_STYLES, "/content/styles/pages/blog.css"]],
  ["/about", [...SHARED_ROUTE_STYLES, "/content/styles/pages/about.css"]],
  ["/gallery", [...SHARED_ROUTE_STYLES, "/content/styles/pages/gallery.css"]],
  ["/projekte", [...SHARED_ROUTE_STYLES, "/content/styles/pages/projects.css"]],
  ["/admin", [...SHARED_ROUTE_STYLES, "/content/styles/pages/admin.css"]],
  ["/contact", ["/content/components/contact/contact.css"]],
  ["/impressum", ["/content/components/footer/legal-pages.css"]],
  ["/datenschutz", ["/content/components/footer/legal-pages.css"]],
  ["/cookies", ["/content/components/footer/legal-pages.css"]],
  ["/ai-info", ["/content/styles/ai-info.css"]],
]);

function isStandaloneShellPath(pathname = "/") {
  const normalized = normalizePathname(pathname);
  return (
    normalized === "/ai-info" ||
    normalized.startsWith("/pages/ai-info") ||
    normalized === "/admin" ||
    normalized.startsWith("/pages/admin")
  );
}

function getResourcesForPath(pathname = "/") {
  const normalized = normalizePathname(pathname);
  if (!isStandaloneShellPath(pathname)) {
    return [...CORE_RESOURCES, ...getRouteStyleResources(normalized)];
  }

  // Standalone pages do not load the app shell or its third-party module graph.
  // Only advertise resources that the standalone document actually consumes.
  return getRouteStyleResources(normalized);
}

function getRouteStyleResources(pathname = "/") {
  const exact = ROUTE_STYLE_RESOURCES.get(pathname);
  if (exact) return exact.map(href => ({ href: withVersion(href), rel: "preload", as: "style" }));
  if (pathname.startsWith("/blog/")) {
    return (ROUTE_STYLE_RESOURCES.get("/blog") || []).map(href => ({
      href: withVersion(href),
      rel: "preload",
      as: "style",
    }));
  }

  return [];
}

/**
 * Format a single resource entry as an HTTP Link header value.
 * @param {{ href: string, rel: string, as?: string, crossorigin?: boolean }} r
 * @returns {string}
 */
function formatLinkValue(r) {
  let link = `<${r.href}>; rel=${r.rel}`;
  if (r.as) link += `; as=${r.as}`;
  if (r.crossorigin) link += "; crossorigin";
  return link;
}

/**
 * Build individual Link header values for the HTML response.
 * Each entry is appended separately via `headers.append('Link', ...)`.
 *
 * @returns {string[]} Array of formatted Link header values
 */
export function buildResponseLinkHeaders(pathname = "/") {
  return getResourcesForPath(pathname).map(formatLinkValue);
}
