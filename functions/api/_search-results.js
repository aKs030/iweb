/**
 * Search Results Utilities
 * Transformation, deduplication, and result balancing.
 */
import {
  normalizeUrl,
  extractTitle,
  chooseBestTitle,
  detectCategory,
  buildFallbackDescription,
} from './_search-url.js';
import {
  createSnippet,
  highlightMatches,
  isLowQualitySnippet,
} from './_search-content.js';

/**
 * Extract textual content from AI search item candidates.
 * @param {object} item
 * @returns {string}
 */
function toTextContent(item) {
  if (Array.isArray(item?.content)) {
    const joined = item.content
      .map((c) => c?.text || '')
      .join(' ')
      .trim();
    if (joined) return joined;
  }

  if (typeof item?.text === 'string' && item.text.trim()) {
    return item.text;
  }

  if (typeof item?.description === 'string' && item.description.trim()) {
    return item.description;
  }

  return '';
}

/**
 * Normalize an AI item into the API search result schema.
 * @param {object} item
 * @param {string} query
 * @param {number} [snippetMaxLength=170]
 * @returns {{url: string, title: string, category: string, description: string, highlightedDescription: string, vectorScore: number}}
 */
export function toSearchResult(item, query, snippetMaxLength = 170) {
  let url = normalizeUrl(item?.filename);
  if (url === '/search' || url === '/api/search') {
    url = '/';
  }

  const textContent = toTextContent(item);
  const snippet = createSnippet(textContent, query, snippetMaxLength);
  const inferredTitle = extractTitle(item?.filename, url);
  const title = chooseBestTitle(item, inferredTitle, url);
  const category = detectCategory(url);
  let description = snippet || '';

  if (isLowQualitySnippet(description)) {
    description = buildFallbackDescription(url, title, category);
  }

  return {
    url,
    title,
    category,
    description,
    highlightedDescription: highlightMatches(description, query),
    vectorScore: Number(item?.score || 0),
  };
}

/**
 * Deduplicate results by URL, keeping the strongest candidate.
 * @param {Array<{url: string, score: number, description: string}>} results
 * @returns {Array}
 */
export function dedupeByBestScore(results) {
  const bestByUrl = new Map();

  for (const result of results) {
    const existing = bestByUrl.get(result.url);

    if (!existing) {
      bestByUrl.set(result.url, result);
      continue;
    }

    if (result.score > existing.score) {
      bestByUrl.set(result.url, result);
      continue;
    }

    if (result.score === existing.score) {
      const existingLowQuality = isLowQualitySnippet(existing.description);
      const currentLowQuality = isLowQualitySnippet(result.description);

      if (existingLowQuality && !currentLowQuality) {
        bestByUrl.set(result.url, result);
      }
    }
  }

  return [...bestByUrl.values()];
}

/**
 * Keep variety by limiting category saturation in the final result set.
 * @param {Array<{url: string, category: string}>} results
 * @param {number} topK
 * @returns {Array}
 */
export function balanceByCategory(results, topK) {
  const maxPerCategory = Math.max(2, Math.ceil(topK / 2));
  const categoryCount = {};
  const selected = [];
  const selectedUrls = new Set();

  for (const result of results) {
    const category = result.category || 'Seite';
    const count = categoryCount[category] || 0;
    if (count >= maxPerCategory) {
      continue;
    }

    categoryCount[category] = count + 1;
    selected.push(result);
    selectedUrls.add(result.url);

    if (selected.length >= topK) {
      return selected;
    }
  }

  for (const result of results) {
    if (selectedUrls.has(result.url)) {
      continue;
    }

    selected.push(result);
    if (selected.length >= topK) {
      break;
    }
  }

  return selected;
}
