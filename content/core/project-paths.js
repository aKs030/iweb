import { normalizePathname } from "./utils/index.js";

export const PROJECTS_HOME_PATH = "/projekte/";

export function normalizeProjectSlug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "");
}

export function buildProjectDetailPath(value) {
  const slug = normalizeProjectSlug(value);
  if (!slug) return PROJECTS_HOME_PATH;
  return `${PROJECTS_HOME_PATH}${encodeURIComponent(slug)}/`;
}

export function buildProjectCanonicalUrl(origin, value) {
  const base = String(origin || "").replace(/\/+$/g, "");
  return `${base}${buildProjectDetailPath(value)}`;
}

export function isProjectIndexPath(pathname) {
  return /^\/projekte\/?$/i.test(normalizePathname(pathname));
}

function extractProjectSlugFromPath(pathname) {
  const path = normalizePathname(pathname);
  const match = path.match(/^\/projekte\/([^/]+)\/?$/i);
  if (!match) return "";

  try {
    return normalizeProjectSlug(decodeURIComponent(match[1]));
  } catch {
    return normalizeProjectSlug(match[1]);
  }
}

function extractQueryProjectSlug(search = "") {
  try {
    const params = new URLSearchParams(search);
    return normalizeProjectSlug(params.get("app"));
  } catch {
    return "";
  }
}

export function extractProjectSlug(pathname, search = "") {
  const pathSlug = extractProjectSlugFromPath(pathname);
  if (pathSlug) return pathSlug;
  if (!isProjectIndexPath(pathname)) return "";
  return extractQueryProjectSlug(search);
}

export function extractProjectSlugFromLocation(locationLike = globalThis.location) {
  return extractProjectSlug(locationLike?.pathname || "/", locationLike?.search || "");
}
