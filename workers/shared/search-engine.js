/**
 * Search Engine Implementation
 * Optimized with MiniSearch (Inverted Index, BM25 Scoring, Fuzzy Match)
 */
import MiniSearch from 'minisearch';

export class SearchEngine {
  constructor(items) {
    // Initialisierung von MiniSearch mit Gewichtung
    this.miniSearch = new MiniSearch({
      idField: 'id',
      fields: ['title', 'description', 'keywords'], // Felder für die Indexierung
      storeFields: ['id', 'title', 'description', 'url', 'priority'], // Felder für die Rückgabe
      searchOptions: {
        boost: { title: 10, keywords: 5, description: 2 },
        prefix: true, // Präfix-Suche aktivieren (z.B. "ber" -> "berlin")
        fuzzy: 0.2, // Fehlertoleranz (Typos)
      },
    });

    // Daten laden
    this.miniSearch.addAll(items);
  }

  /**
   * Führt die Suche durch
   * @param {string} query - Suchbegriff
   * @param {number} topK - Anzahl der Ergebnisse
   */
  search(query, topK) {
    const q = String(query || '').trim();

    if (!q) return [];

    // Suche ausführen
    const results = this.miniSearch.search(q);

    // Ergebnisse verarbeiten und Priorität einbeziehen
    const enrichedResults = results.map((r) => {
      // MiniSearch Score + Statische Priorität der Seite (z.B. Home = 10)
      // Wir multiplizieren die Priorität leicht, damit wichtige Seiten bei gleicher Relevanz gewinnen
      const finalScore = r.score + (r.priority || 0) * 0.5;

      return {
        id: r.id,
        title: r.title,
        description: r.description,
        url: r.url,
        score: finalScore,
      };
    });

    // Sortieren nach finalem Score und Begrenzung auf topK
    return enrichedResults.sort((a, b) => b.score - a.score).slice(0, topK);
  }
}
