/**
 * Shared Search Utilities
 * Reusable full-text search with relevance scoring
 */
import { SearchEngine } from './search-engine.js';

let cachedEngine = null;
let lastIndexRef = null;

/**
 * Performs full-text search on the index with relevance scoring
 * @param {string} query - Search query
 * @param {number} topK - Number of results to return
 * @param {Array} searchIndex - Search index data
 * @param {boolean} includeScore - Whether to include score in results
 * @returns {Array} Sorted search results
 */
export function performSearch(query, topK, searchIndex, includeScore = false) {
  // Check if we need to (re)build the index
  if (searchIndex !== lastIndexRef) {
    cachedEngine = new SearchEngine(searchIndex);
    lastIndexRef = searchIndex;
  }

  const results = cachedEngine.search(query, topK);

  // Return with or without score
  return results.map((r) => {
    const result = {
      id: r.id,
      title: r.title,
      description: r.description,
      url: r.url,
    };
    if (includeScore) {
      result.score = r.score;
    }
    return result;
  });
}

/**
 * Augments prompt with RAG context
 * @param {string} prompt - Original prompt
 * @param {Array} sources - Search results to use as context
 * @returns {string} Augmented prompt
 */
export function augmentPromptWithRAG(prompt, sources) {
  if (!sources.length) return prompt;

  const srcText = sources
    .map((s, i) => `[[${i + 1}] ${s.title} — ${s.url}]: ${s.description}`)
    .join('\n');

  return `Nutze die folgenden relevanten Informationen von der Website als Kontext (falls hilfreich):\n${srcText}\n\nFrage: ${prompt}`;
}
