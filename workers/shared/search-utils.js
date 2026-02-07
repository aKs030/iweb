/**
 * Search Utilities
 * Integration with Cloudflare AI Search (Beta)
 */

/**
 * Executes a search against the Cloudflare AI Search binding
 * @param {string} query
 * @param {number} topK
 * @param {Object} aiSearchBinding - The env.AI_SEARCH binding
 */
export async function performSearch(query, topK, aiSearchBinding) {
  if (!aiSearchBinding) {
    throw new Error('AI_SEARCH binding is not configured');
  }

  const q = String(query || '')
    .toLowerCase()
    .trim();
  if (!q) return [];

  try {
    const response = await aiSearchBinding.search(q, { limit: topK });

    // Ensure we return a consistent format for the frontend
    return (response.results || []).map((r) => ({
      id: r.id || r.url,
      title: r.title || 'Kein Titel',
      description: r.description || '',
      url: r.url || '#',
      score: r.score,
    }));
  } catch (error) {
    console.error('AI Search Error:', error);
    return [];
  }
}

/**
 * Augments a prompt with RAG context from search results
 * @param {string} prompt
 * @param {Array} sources
 */
export function augmentPromptWithRAG(prompt, sources) {
  if (!sources.length) return prompt;

  const ctx = sources
    .map((s, i) => `[${i + 1}] ${s.title} (${s.url}): ${s.description}`)
    .join('\n');

  return `Nutze folgende Website-Informationen als Kontext:\n${ctx}\n\nFrage: ${prompt}`;
}
