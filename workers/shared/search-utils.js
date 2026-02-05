/**
 * Shared Search Utilities
 * Reusable full-text search using Cloudflare D1 (SQLite FTS5)
 */

/**
 * Performs full-text search on the D1 database
 * @param {string} query - Search query
 * @param {number} topK - Number of results to return
 * @param {Object} env - Worker environment (must contain DB binding)
 * @param {boolean} includeScore - Whether to include score in results
 * @returns {Promise<Array>} Sorted search results
 */
export async function performSearch(query, topK, env, includeScore = false) {
  if (!query || !env.DB) return [];

  // Tokenize and prepare FTS query (prefix matching for each token)
  // e.g. "foo bar" -> "foo* bar*"
  const tokens = query.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [];

  // FTS5 query syntax: we use explicit AND and prefix matching
  const ftsQuery = tokens.map((t) => `"${t.replace(/"/g, '')}"*`).join(' AND ');

  try {
    // Select results using FTS5 match
    // We order by rank (default BM25, lower is better)
    const stmt = env.DB.prepare(`
      SELECT id, title, description, url, category, rank
      FROM search_index
      WHERE search_index MATCH ?
      ORDER BY rank
      LIMIT ?
    `).bind(ftsQuery, topK);

    const { results } = await stmt.all();

    return results.map((r) => {
      const result = {
        id: r.id,
        title: r.title,
        description: r.description,
        url: r.url,
      };
      if (includeScore) {
        // FTS5 rank is lower = better.
        // We return it as is. Consumers should handle it or just rely on the array order.
        result.score = r.rank;
      }
      return result;
    });
  } catch (error) {
    console.error('D1 Search Error:', error);
    return [];
  }
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
