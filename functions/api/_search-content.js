/**
 * Search Content Utilities
 * Snippet generation, highlighting, and text cleaning.
 */
import { CLEANUP_PATTERNS, HTML_ENTITIES } from './_cleanup-patterns.js';

/**
 * Detect whether a snippet is too low quality to display.
 * Returns true when the text is empty, too short, or consists mostly of
 * non-word characters / known placeholder strings.
 * @param {string} text - The snippet to evaluate
 * @param {number} [minLength=12] - Minimum meaningful length
 * @returns {boolean} true if the snippet should be replaced with a fallback
 */
export function isLowQualitySnippet(text, minLength = 12) {
  if (!text) return true;
  const trimmed = text.trim();
  if (trimmed.length < minLength) return true;

  // Mostly non-word characters (JSON debris, punctuation soup)
  const wordChars = trimmed.replace(/[^a-zA-ZäöüÄÖÜß]/g, '');
  if (wordChars.length < 6) return true;

  // Looks like an anchor-only remnant, e.g. "(#main-content)"
  if (/^\(?#[a-z-]+\)?$/i.test(trimmed)) return true;

  // Contains JSON-LD / structured-data debris
  if (/@type|@context|ListItem|"position"|```json/i.test(trimmed)) return true;

  // Known placeholder strings
  const PLACEHOLDERS = ['keine beschreibung', 'css-modus', 'no description'];
  const lower = trimmed.toLowerCase();
  return PLACEHOLDERS.some((p) => lower.includes(p) && trimmed.length < 40);
}

/**
 * Clean description text by removing HTML tags and metadata artifacts
 * @param {string} text - Raw text content
 * @returns {string} Cleaned plain text
 */
export function cleanDescription(text) {
  if (!text) return '';

  let cleaned = text;

  for (const [pattern, replacement] of CLEANUP_PATTERNS) {
    cleaned = cleaned.replace(pattern, replacement);
  }

  // Decode HTML entities
  cleaned = cleaned.replace(/&[a-z0-9#]+;/gi, (m) => HTML_ENTITIES[m] || '');

  // Normalize whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  return cleaned;
}

/**
 * Wrap matching query terms in <mark> tags for highlight rendering.
 * Only operates on plain-text content (no nested HTML expected).
 * @param {string} text - Plain text to highlight
 * @param {string} query - Original search query
 * @returns {string} Text with <mark> wrapped matches
 */
export function highlightMatches(text, query) {
  if (!text || !query) return text || '';

  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 1)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

  if (terms.length === 0) return text;

  const pattern = new RegExp(`(${terms.join('|')})`, 'gi');
  return text.replace(pattern, '<mark></mark>');
}

/**
 * Creates a smart text snippet focused on the query terms
 * @param {string} content - Full text content
 * @param {string} query - Search query
 * @param {number} maxLength - Maximum length of the snippet (default: 160)
 * @returns {string} Context-aware snippet
 */
export function createSnippet(content, query, maxLength = 160) {
  if (!content || !query) return content ? content.substring(0, maxLength) : '';

  const cleanContent = cleanDescription(content);
  const words = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2);

  // If no valid query words, return start of content
  if (words.length === 0) {
    return (
      cleanContent.substring(0, maxLength) +
      (cleanContent.length > maxLength ? '...' : '')
    );
  }

  // Find the first occurrence of any query word
  let bestIndex = -1;
  const contentLower = cleanContent.toLowerCase();

  for (const word of words) {
    const index = contentLower.indexOf(word);
    if (index !== -1) {
      if (bestIndex === -1 || index < bestIndex) {
        bestIndex = index;
      }
    }
  }

  // If match found, center the window around it
  if (bestIndex !== -1) {
    const halfLength = Math.floor(maxLength / 2);
    let start = Math.max(0, bestIndex - halfLength);
    let end = start + maxLength;

    // Adjust if window goes beyond end
    if (end > cleanContent.length) {
      end = cleanContent.length;
      start = Math.max(0, end - maxLength);
    }

    // Try to align start to a word boundary
    if (start > 0) {
      const spaceIndex = cleanContent.lastIndexOf(' ', start);
      if (spaceIndex !== -1 && start - spaceIndex < 20) {
        start = spaceIndex + 1;
      }
    }

    // Try to align end to a word boundary
    if (end < cleanContent.length) {
      const spaceIndex = cleanContent.indexOf(' ', end);
      if (spaceIndex !== -1 && spaceIndex - end < 20) {
        end = spaceIndex;
      }
    }

    let snippet = cleanContent.substring(start, end);

    // Add ellipsis if needed
    if (start > 0) snippet = '...' + snippet;
    if (end < cleanContent.length) snippet = snippet + '...';

    return snippet;
  }

  // Fallback: Return start of content if no match found
  return (
    cleanContent.substring(0, maxLength) +
    (cleanContent.length > maxLength ? '...' : '')
  );
}

export function toPlainText(value) {
  return String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function truncateText(value, maxLength = 220) {
  const text = toPlainText(value);
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength - 1).trim()}...`;
}
