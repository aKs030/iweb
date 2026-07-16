import { BASE_URL } from "../../../config/constants.js";

const HTTP_PROTOCOLS = new Set(["http:", "https:"]);

function getDefaultBaseUrl() {
  return globalThis.location?.origin || BASE_URL;
}

function normalizeHostname(hostname) {
  return String(hostname || "")
    .trim()
    .toLowerCase();
}

function getTrustedInternalHosts(currentHostname = globalThis.location?.hostname) {
  const hosts = new Set();
  const pushHost = value => {
    const normalized = normalizeHostname(value);
    if (!normalized) return;
    hosts.add(normalized);
    hosts.add(
      normalized.startsWith("www.") ? normalized.replace(/^www\./, "") : `www.${normalized}`
    );
  };

  pushHost(currentHostname);
  try {
    pushHost(new URL(BASE_URL).hostname);
  } catch {
    // Ignore an invalid configured base URL.
  }
  return hosts;
}

function parseUrl(rawUrl, options = {}) {
  const value = String(rawUrl || "").trim();
  if (!value) return null;
  try {
    return new URL(value, options.base || getDefaultBaseUrl());
  } catch {
    return null;
  }
}

export function normalizeHttpUrl(rawUrl, options = {}) {
  const parsed = parseUrl(rawUrl, options);
  return parsed && HTTP_PROTOCOLS.has(parsed.protocol) ? parsed.toString() : "";
}

export function sanitizeInternalNavigationUrl(rawUrl, options = {}) {
  const parsed = parseUrl(rawUrl, options);
  if (!parsed || !HTTP_PROTOCOLS.has(parsed.protocol)) return "";

  const allowedHosts = new Set(
    Array.from(
      options.allowedHosts || getTrustedInternalHosts(globalThis.location?.hostname),
      normalizeHostname
    )
  );
  if (!allowedHosts.has(normalizeHostname(parsed.hostname))) return "";
  return `${parsed.pathname}${parsed.search}${parsed.hash}` || "/";
}

export function formatCompactUrlPath(rawUrl, options = {}) {
  const fallback = String(rawUrl || "").trim();
  if (!fallback) return "";

  const parsed = parseUrl(fallback, options);
  if (!parsed) {
    const fallbackMaxLength = Number(options.fallbackMaxLength || 46);
    return fallback.length > fallbackMaxLength
      ? `${fallback.slice(0, fallbackMaxLength - 3)}...`
      : fallback;
  }

  const basePath = parsed.pathname || "/";
  const maxPathLength = Number(options.maxPathLength || 44);
  const compactPath =
    basePath.length > maxPathLength
      ? `${basePath.slice(0, maxPathLength - 3).replace(/\/+$/g, "")}...`
      : basePath;
  return `${compactPath}${parsed.search}`;
}
