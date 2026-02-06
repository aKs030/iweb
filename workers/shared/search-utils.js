/**
 * Search Utilities
 * Full-text search with inverted index, prefix matching & RAG augmentation
 */

// ---------------------------------------------------------------------------
// Search Engine (Inverted Index + Prefix Matching)
// ---------------------------------------------------------------------------

class SearchEngine {
  constructor(items) {
    this.items = items;
    this.index = new Map(); // token → Set<id>
    this.ids = new Map(); // id → item
    this.sortedTokens = [];
    this.#buildIndex();
  }

  #tokenize(text) {
    return String(text || '')
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);
  }

  #buildIndex() {
    for (const item of this.items) {
      this.ids.set(item.id, item);
      const text = `${item.title || ''} ${item.description || ''} ${(item.keywords || []).join(' ')}`;

      for (const token of this.#tokenize(text)) {
        if (!this.index.has(token)) this.index.set(token, new Set());
        this.index.get(token).add(item.id);
      }
    }
    this.sortedTokens = [...this.index.keys()].sort();
  }

  search(query, topK) {
    const q = String(query || '')
      .toLowerCase()
      .trim();
    if (!q) return [];

    const words = this.#tokenize(q);
    const candidateIds = new Set();

    // Candidate generation via prefix matching (binary search)
    for (const word of words) {
      let lo = 0,
        hi = this.sortedTokens.length - 1,
        idx = -1;
      while (lo <= hi) {
        const mid = (lo + hi) >>> 1;
        if (this.sortedTokens[mid] >= word) {
          idx = mid;
          hi = mid - 1;
        } else lo = mid + 1;
      }
      if (idx === -1) continue;
      for (let i = idx; i < this.sortedTokens.length; i++) {
        const token = this.sortedTokens[i];
        if (!token.startsWith(word)) break;
        for (const id of this.index.get(token)) candidateIds.add(id);
      }
    }

    // Scoring
    const results = [];
    for (const id of candidateIds) {
      const item = this.ids.get(id);
      if (!item) continue;
      const score = this.#score(item, q, words);
      if (score > 0) results.push({ ...item, score });
    }

    return results.sort((a, b) => b.score - a.score).slice(0, topK);
  }

  #score(item, q, words) {
    let s = item.priority || 0;
    const title = (item.title || '').toLowerCase();
    const desc = (item.description || '').toLowerCase();
    const kws = (item.keywords || []).map((k) => (k || '').toLowerCase());

    if (title === q) s += 1000;
    else if (title.startsWith(q)) s += 500;
    else if (title.includes(q)) s += 200;

    if (desc.includes(q)) s += 100;

    for (const k of kws) {
      if (k === q) s += 150;
      else if (k.startsWith(q)) s += 80;
      else if (k.includes(q)) s += 40;
    }

    for (const w of words) {
      if (title.includes(w)) s += 30;
      if (desc.includes(w)) s += 15;
      for (const k of kws) {
        if (k.includes(w)) s += 20;
      }
    }

    return s;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

let cachedEngine = null;
let lastIndexRef = null;

/**
 * Full-text search with relevance scoring
 * @param {string} query
 * @param {number} topK
 * @param {Array} searchIndex
 * @param {boolean} [includeScore=false]
 */
export function performSearch(query, topK, searchIndex, includeScore = false) {
  if (searchIndex !== lastIndexRef) {
    cachedEngine = new SearchEngine(searchIndex);
    lastIndexRef = searchIndex;
  }

  return cachedEngine
    .search(query, topK)
    .map(({ id, title, description, url, score }) => ({
      id,
      title,
      description,
      url,
      ...(includeScore && { score }),
    }));
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
