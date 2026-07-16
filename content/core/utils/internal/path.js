export function canonicalizeUrlPath(path) {
  if (!path) return "/";
  let normalized = String(path).trim();
  if (!normalized.startsWith("/")) normalized = "/" + normalized;

  if (normalized.endsWith("/index.html")) {
    normalized = normalized.substring(0, normalized.length - 11);
  } else if (normalized.endsWith(".html")) {
    normalized = normalized.substring(0, normalized.length - 5);
  }

  if (normalized === "") return "/";
  if (normalized !== "/" && normalized.endsWith("/")) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}

export function normalizePathname(pathname) {
  const source = String(pathname || "/");
  const noQuery = source.split("?")[0] || "";
  const noHash = noQuery.split("#")[0] || "";
  const normalized = noHash.replace(/\/+/g, "/");
  return normalized === "" || normalized === "/" ? "/" : normalized.replace(/\/$/, "");
}
