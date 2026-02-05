/**
 * Search Engine Implementation
 * Optimized Inverted Index with Prefix Matching
 */
export class SearchEngine {
  constructor(items) {
    this.items = items;
    this.index = new Map(); // Token -> Set<ID>
    this.ids = new Map(); // ID -> Item mapping
    this.sortedTokens = [];
    this.buildIndex();
  }

  /**
   * Tokenizes text into words
   */
  tokenize(text) {
    // Split by whitespace and non-word characters except simplistic ones if needed?
    // The original split was /\s+/. sticking to that.
    return String(text || '')
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);
  }

  /**
   * Builds the inverted index
   */
  buildIndex() {
    this.items.forEach((item) => {
      this.ids.set(item.id, item);
      // Index title, description, and keywords
      const text = `${item.title || ''} ${item.description || ''} ${(
        item.keywords || []
      ).join(' ')}`;
      const tokens = this.tokenize(text);

      tokens.forEach((token) => {
        if (!this.index.has(token)) {
          this.index.set(token, new Set());
        }
        this.index.get(token).add(item.id);
      });
    });

    // Sort tokens for binary search / prefix matching
    this.sortedTokens = Array.from(this.index.keys()).sort();
  }

  /**
   * Performs the search
   */
  search(query, topK) {
    const q = String(query || '')
      .toLowerCase()
      .trim();
    if (!q) return [];

    const queryWords = this.tokenize(q);
    const candidateIds = new Set();

    // 1. Candidate Generation (Token + Prefix Match)
    // If query is "Ber", we find "Berlin" token and add its docIDs.
    queryWords.forEach((word) => {
      // Binary search for the first token >= word
      let start = 0,
        end = this.sortedTokens.length - 1;
      let idx = -1;

      while (start <= end) {
        let mid = Math.floor((start + end) / 2);
        if (this.sortedTokens[mid] >= word) {
          idx = mid;
          end = mid - 1;
        } else {
          start = mid + 1;
        }
      }

      // Collect all tokens that start with 'word'
      if (idx !== -1) {
        for (let i = idx; i < this.sortedTokens.length; i++) {
          const token = this.sortedTokens[i];
          if (!token.startsWith(word)) break;

          const ids = this.index.get(token);
          if (ids) {
            ids.forEach((id) => candidateIds.add(id));
          }
        }
      }
    });

    // 2. Scoring (Only for candidates)
    const results = [];
    candidateIds.forEach((id) => {
      const item = this.ids.get(id);
      if (!item) return;

      const score = this.calculateScore(item, q, queryWords);
      if (score > 0) {
        results.push({ ...item, score });
      }
    });

    // Sort by score and slice
    return results.sort((a, b) => b.score - a.score).slice(0, topK);
  }

  /**
   * Calculates relevance score (Legacy Logic)
   */
  calculateScore(item, q, words) {
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

    return score;
  }
}
