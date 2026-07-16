import { SITE_NAME, SITE_OWNER_NAME } from "../../../config/site-seo.js";

export function normalizeText(value, fallback = "") {
  return String(value ?? "").trim() || fallback;
}

export function normalizeSchemaText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeForMatch(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function uniqueSchemaList(values) {
  const result = [];
  const seen = new Set();
  for (const raw of values || []) {
    const value = normalizeSchemaText(raw);
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  return result;
}

export function formatSlug(slug = "") {
  return String(slug)
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function humanizeSlug(value) {
  return String(value || "")
    .replace(/[_+]/g, "-")
    .split("-")
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
    .trim();
}

export function sanitizeDiscoveryText(value, fallback = "") {
  const source = normalizeText(value, fallback);
  if (!source) return "";
  return source
    .replace(/Abdul\s*Berlin/gi, "Abdulkerim Sesli")
    .replace(/\bBerlin\b/gi, "")
    .replace(/#Abdulberlin/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
}

export function escapeHtml(text) {
  if (!text) return "";
  const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return String(text).replace(/[&<>"']/g, char => entities[char] || char);
}

export function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const BRAND_REGEX = new RegExp(
  `\\s*(?:[—–-]\\s*${escapeRegExp(SITE_OWNER_NAME)}|\\|\\s*${escapeRegExp(
    SITE_OWNER_NAME
  )}|${escapeRegExp(SITE_NAME)})\\s*$`,
  "i"
);

export function stripBranding(input) {
  return String(input || "")
    .replace(BRAND_REGEX, "")
    .trim();
}

export function escapeXml(value) {
  const entities = { "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" };
  return String(value ?? "").replace(/[<>&'"]/g, char => entities[char] || char);
}
