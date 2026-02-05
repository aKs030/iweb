/**
 * Search Engine Implementation
 * Optimized with MiniSearch (Inverted Index, BM25 Scoring, Fuzzy Match)
 */
import MiniSearch from 'minisearch';

export class SearchEngine {
  constructor(items) {
    // Initialize MiniSearch with field configuration
    this.miniSearch = new MiniSearch({
      idField: 'id',
      fields: ['title', 'description', 'keywords'], // Fields to index
      storeFields: ['id', 'title', 'description', 'url', 'priority'], // Fields to return
    });

    // Load data into the index
    this.miniSearch.addAll(items);
  }

  /**
   * Performs a search query
   * @param {string} query - Search term
   * @param {number} topK - Number of results to return
   * @returns {Array} Array of search results with id, title, description, url, and score
   */
  search(query, topK) {
    const q = String(query || '').trim();

    if (!q) return [];

    // Execute search with MiniSearch options
    const results = this.miniSearch.search(q, {
      boost: { title: 10, keywords: 5, description: 2 },
      prefix: true, // Enable prefix matching (e.g., "ber" -> "berlin")
      fuzzy: 0.2, // Typo tolerance (20% edit distance)
    });

    // Process results and incorporate static priority
    const enrichedResults = results.map((r) => {
      // MiniSearch score + static page priority (e.g., Home = 10)
      // Priority is multiplied by 0.5 to prevent it from dominating the relevance score
      // This ensures MiniSearch's BM25 score remains the primary factor while giving
      // important pages a slight advantage when relevance is similar
      const finalScore = r.score + (r.priority || 0) * 0.5;

      return {
        id: r.id,
        title: r.title,
        description: r.description,
        url: r.url,
        score: finalScore,
      };
    });

    // Sort by final score and limit to topK results
    return enrichedResults.sort((a, b) => b.score - a.score).slice(0, topK);
  }
}
