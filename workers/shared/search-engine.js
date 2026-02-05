/**
 * Search Engine Implementation
 * Optimized with MiniSearch (Inverted Index, BM25 Scoring, Fuzzy Match)
 */
import MiniSearch from 'minisearch';

export class SearchEngine {
  constructor(items) {
    // Initialize MiniSearch with weights and configuration
    this.miniSearch = new MiniSearch({
      idField: 'id',
      fields: ['title', 'description', 'keywords'], // Fields to index
      storeFields: ['id', 'title', 'description', 'url', 'priority'], // Fields to return
      searchOptions: {
        boost: { title: 10, keywords: 5, description: 2 },
        prefix: true, // Enable prefix search (e.g., "ber" -> "berlin")
        fuzzy: 0.2, // Fuzzy matching tolerance (for typos)
      },
    });

    // Load data
    this.miniSearch.addAll(items);
  }

  /**
   * Performs the search
   * @param {string} query - Search query
   * @param {number} topK - Number of results to return
   * @returns {Array} Sorted search results
   */
  search(query, topK) {
    const q = String(query || '').trim();

    if (!q) return [];

    // Execute search
    // Note: searchOptions defined in constructor are automatically applied here
    const results = this.miniSearch.search(q);

    // Process results and include static priority
    const enrichedResults = results.map((r) => {
      // MiniSearch Score + Static Page Priority (e.g., Home = 10)
      // NOTE: In the legacy implementation, priority was added directly (score += item.priority).
      // Here we weight it by 0.5 to prevent static priority from dominating the relevance score too heavily,
      // while still giving a boost to important pages.
      const finalScore = r.score + (r.priority || 0) * 0.5;

      return {
        id: r.id,
        title: r.title,
        description: r.description,
        url: r.url,
        score: finalScore,
      };
    });

    // Sort by final score and limit to topK
    return enrichedResults.sort((a, b) => b.score - a.score).slice(0, topK);
  }
}
