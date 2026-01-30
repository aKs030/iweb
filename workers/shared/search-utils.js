/**
 * Shared Search Utilities
 * Reusable full-text search with relevance scoring
 */

/**
 * Performs full-text search on the index with relevance scoring
 * @param {string} query - Search query
 * @param {number} topK - Number of results to return
 * @param {Array} searchIndex - Search index data
 * @param {boolean} includeScore - Whether to include score in results
 * @returns {Array} Sorted search results
 */
export function performSearch(query, topK, searchIndex, includeScore = false) {
  const q = String(query || '')
    .toLowerCase()
    .trim();
  if (!q) return [];

  const words = q.split(/\s+/).filter(Boolean);

  const results = searchIndex.map((item) => {
    let score = item.priority || 0;
    const title = (item.title || '').toLowerCase();
    const desc = (item.description || '').toLowerCase();

    // Exact title match - highest priority
    if (title === q) score += 1000;
    else if (title.startsWith(q)) score += 500;
    else if (title.includes(q)) score += 200;

    // Description match
    if (desc.includes(q)) score += 100;

    // Keyword matching
    (item.keywords || []).forEach((k) => {
      const kl = (k || '').toLowerCase();
      if (kl === q) score += 150;
      else if (kl.startsWith(q)) score += 80;
      else if (kl.includes(q)) score += 40;
    });

    // Multi-word matching
    words.forEach((w) => {
      if (title.includes(w)) score += 30;
      if (desc.includes(w)) score += 15;
      (item.keywords || []).forEach((k) => {
        if ((k || '').toLowerCase().includes(w)) score += 20;
      });
    });

    return { ...item, score };
  });

  const filtered = results
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  // Return with or without score
  return filtered.map((r) => {
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
