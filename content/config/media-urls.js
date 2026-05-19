import { isLocalDevRuntime } from "../core/runtime-env.js";

const R2_PUBLIC_BASE_URL = "https://img.abdulkerimsesli.de";
export const R2_PUBLIC_ORIGIN = new URL(R2_PUBLIC_BASE_URL).origin;
export const R2_PROXY_BASE_PATH = "/r2-proxy";

const ICONS_VERSION = "20260221";
const APP_PREVIEWS_VERSION = "20260221";

export const FAVICON_ICO_URL = buildIconUrl("favicon.ico");
export const FAVICON_512_URL = buildIconUrl("favicon-512.webp");

export const OG_HOME_IMAGE_URL = buildBlogUrl("og-home-800.png");
export const OG_PROJECTS_IMAGE_URL = buildBlogUrl("og-projekte-800.png");
export const OG_VIDEOS_IMAGE_URL = buildBlogUrl("og-videos-800.png");
export const OG_DESIGN_IMAGE_URL = buildBlogUrl("og-design-800.png");
export const OG_PHOTOGRAPHY_IMAGE_URL = buildBlogUrl("og-photography-800.png");

function normalizeMediaText(value) {
  return String(value || "").trim();
}

function encodeMediaPathSegment(segment) {
  try {
    return encodeURIComponent(decodeURIComponent(segment));
  } catch {
    return encodeURIComponent(segment);
  }
}

function normalizeR2Path(pathname) {
  const rawPath = String(pathname || "")
    .trim()
    .replace(/^\/+/, "");

  if (!rawPath) return "";

  const normalizedSegments = rawPath
    .split("/")
    .filter(Boolean)
    .map(segment => encodeMediaPathSegment(segment));

  return normalizedSegments.length > 0 ? `/${normalizedSegments.join("/")}` : "";
}

function normalizeSearch(search = "") {
  const normalized = normalizeMediaText(search);
  if (!normalized) return "";
  return normalized.startsWith("?") ? normalized : `?${normalized}`;
}

function buildVersionSearch(version) {
  const normalized = normalizeMediaText(version);
  return normalized ? `v=${normalized}` : "";
}

export function buildR2Url(pathname, search = "") {
  const normalizedPath = normalizeR2Path(pathname);
  if (!normalizedPath) return "";

  const mediaUrl = new URL(normalizedPath, `${R2_PUBLIC_BASE_URL}/`);
  const normalizedSearch = normalizeSearch(search);
  if (normalizedSearch) {
    mediaUrl.search = normalizedSearch;
  }

  return mediaUrl.toString();
}

function buildIconUrl(filename, version = ICONS_VERSION) {
  return buildR2Url(`icons/${filename}`, buildVersionSearch(version));
}

function buildBlogUrl(filename, search = "") {
  return buildR2Url(`blog/${filename}`, search);
}

function getProjectPreviewName(project) {
  if (project && typeof project === "object") {
    if (project.previewMedia === null || project.previewMedia === false) {
      return "";
    }

    return normalizeMediaText(
      project.previewMedia || project.dirName || project.name || project.id
    );
  }

  return normalizeMediaText(project);
}

export function buildProjectPreviewUrl(project, version = APP_PREVIEWS_VERSION) {
  const previewName = getProjectPreviewName(project);
  if (!previewName) return "";
  return buildR2Url(`app/${previewName}.svg`, buildVersionSearch(version));
}

function resolveR2Url(value, locationLike = globalThis.location) {
  const rawValue = normalizeMediaText(value);
  if (!rawValue) return "";

  try {
    const baseHref = locationLike?.href || `${R2_PUBLIC_BASE_URL}/`;
    const mediaUrl = new URL(rawValue, baseHref);

    if (mediaUrl.origin !== R2_PUBLIC_ORIGIN) {
      return rawValue;
    }

    if (!isLocalDevRuntime(locationLike)) {
      return mediaUrl.toString();
    }

    return `${R2_PROXY_BASE_PATH}${mediaUrl.pathname}${mediaUrl.search}`;
  } catch {
    return rawValue;
  }
}

export function resolveProjectPreviewUrl(project, locationLike = globalThis.location) {
  const configuredUrl = normalizeMediaText(project?.previewUrl);
  return resolveR2Url(configuredUrl || buildProjectPreviewUrl(project), locationLike);
}

export function resolveR2Path(pathname, locationLike = globalThis.location, search = "") {
  const mediaUrl = buildR2Url(pathname, search);
  if (!mediaUrl) return "";
  return resolveR2Url(mediaUrl, locationLike);
}
