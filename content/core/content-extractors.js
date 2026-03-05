const WORD_SPLIT_PATTERN = /[\s,.;:/()[\]|!?-]+/;
const MAIN_HEADING_SELECTOR = 'main h1, main h2, main h3';
const MAIN_IMAGE_ALT_SELECTOR = 'main img[alt]';
const MAIN_VIDEO_TITLE_SELECTOR =
  'main iframe[title], main video[title], main video[aria-label]';

function normalizeString(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function uniqueStrings(values) {
  const seen = new Set();
  const items = [];

  for (const value of values || []) {
    const normalized = normalizeString(value);
    if (!normalized) continue;

    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(normalized);
  }

  return items;
}

/**
 * @param {Document} doc
 * @returns {string[]}
 */
export function extractMainHeadingTexts(doc) {
  return uniqueStrings(
    Array.from(doc?.querySelectorAll?.(MAIN_HEADING_SELECTOR) || []).map(
      (node) => node.textContent,
    ),
  );
}

/**
 * @param {Document} doc
 * @returns {string[]}
 */
export function extractMainImageAltTexts(doc) {
  return uniqueStrings(
    Array.from(doc?.querySelectorAll?.(MAIN_IMAGE_ALT_SELECTOR) || []).map(
      (node) => node.getAttribute('alt'),
    ),
  );
}

/**
 * @param {Document} doc
 * @returns {string[]}
 */
export function extractMainVideoTitles(doc) {
  return uniqueStrings(
    Array.from(doc?.querySelectorAll?.(MAIN_VIDEO_TITLE_SELECTOR) || []).map(
      (node) => node.getAttribute('title') || node.getAttribute('aria-label'),
    ),
  );
}

/**
 * @param {Document} doc
 * @param {{ minTokenLength?: number, maxTerms?: number }} [options]
 * @returns {string[]}
 */
export function extractMainHeadingTerms(doc, options = {}) {
  const minTokenLength = Number(options.minTokenLength || 3);
  const maxTerms = Number(options.maxTerms || 20);
  const tokens = [
    ...extractMainHeadingTexts(doc),
    ...extractMainImageAltTexts(doc),
  ]
    .flatMap((value) =>
      normalizeString(value)
        .split(WORD_SPLIT_PATTERN)
        .map((token) => token.trim())
        .filter((token) => token.length >= minTokenLength),
    )
    .filter(Boolean);

  return uniqueStrings(tokens).slice(0, maxTerms);
}
