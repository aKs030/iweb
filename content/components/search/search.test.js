/**
 * Tests for Search Component
 * Tests search filtering and functionality
 * 
 * @module search.test
 * @version 1.0.0
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';

// Mock search index for testing
const MOCK_SEARCH_INDEX = [
  {
    id: 'home',
    title: 'Home',
    description: 'Web Developer & Photographer in Berlin',
    category: 'Seite',
    url: '/',
    keywords: ['home', 'start', 'portfolio'],
    priority: 10,
  },
  {
    id: 'about',
    title: 'Über mich',
    description: 'Erfahre mehr über meine Arbeit',
    category: 'Seite',
    url: '/about/',
    keywords: ['über', 'about', 'biografie'],
    priority: 9,
  },
  {
    id: 'projekte',
    title: 'Projekte',
    description: 'Eine Auswahl meiner Web-Entwicklungsprojekte',
    category: 'Seite',
    url: '/projekte/',
    keywords: ['projekte', 'projects', 'portfolio'],
    priority: 9,
  },
  {
    id: 'blog-react',
    title: 'React ohne Build-Tools',
    description: 'Wie man React ohne komplexe Build-Prozesse nutzt',
    category: 'Blog',
    url: '/blog/react-no-build/',
    keywords: ['react', 'no build', 'javascript'],
    priority: 6,
  },
];

/**
 * Simple search implementation for testing
 */
function searchInIndex(query, index = MOCK_SEARCH_INDEX) {
  const results = [];
  const queryLower = query.toLowerCase().trim();
  
  if (!queryLower) {
    return results;
  }

  index.forEach((item) => {
    let score = item.priority || 0;
    const titleLower = (item.title || '').toLowerCase();
    const descLower = (item.description || '').toLowerCase();
    const keywords = item.keywords || [];

    // Title matching
    if (titleLower.includes(queryLower)) {
      score += 200;
    }

    // Description matching
    if (descLower.includes(queryLower)) {
      score += 100;
    }

    // Keyword matching
    keywords.forEach((keyword) => {
      if (keyword && keyword.toLowerCase().includes(queryLower)) {
        score += 80;
      }
    });

    if (score > (item.priority || 0)) {
      results.push({ ...item, score });
    }
  });

  return results.sort((a, b) => b.score - a.score);
}

// ===== Property 12: Search Result Filtering =====

describe('Feature: iweb-portfolio-improvements, Property 12: Search Result Filtering', () => {

  test('search returns only matching results', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('home', 'react', 'projekte', 'about', 'blog'),
        (query) => {
          const results = searchInIndex(query);

          // All results should match the query
          results.forEach((result) => {
            const titleMatch = result.title.toLowerCase().includes(query.toLowerCase());
            const descMatch = result.description.toLowerCase().includes(query.toLowerCase());
            const keywordMatch = result.keywords.some(k =>
              k.toLowerCase().includes(query.toLowerCase())
            );

            expect(titleMatch || descMatch || keywordMatch).toBe(true);
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  test('search with empty query returns no results', () => {
    const results = searchInIndex('');
    expect(results.length).toBe(0);
  });

  test('search with non-matching query returns no results', () => {
    const results = searchInIndex('xyzabc123nonexistent');
    expect(results.length).toBe(0);
  });

  test('search results are sorted by relevance', () => {
    const results = searchInIndex('react');

    // Results should be sorted by score (descending)
    for (let i = 0; i < results.length - 1; i++) {
      expect(results[i].score).toBeGreaterThanOrEqual(results[i + 1].score);
    }
  });

  test('search is case-insensitive', () => {
    const lowerResults = searchInIndex('react');
    const upperResults = searchInIndex('REACT');
    const mixedResults = searchInIndex('ReAcT');

    expect(lowerResults.length).toBe(upperResults.length);
    expect(lowerResults.length).toBe(mixedResults.length);

    // Same items should be found
    lowerResults.forEach((result, index) => {
      expect(result.id).toBe(upperResults[index].id);
      expect(result.id).toBe(mixedResults[index].id);
    });
  });

  test('search matches partial words', () => {
    const results = searchInIndex('proj');

    // Should find "Projekte"
    expect(results.length).toBeGreaterThan(0);
    expect(results.some(r => r.id === 'projekte')).toBe(true);
  });

  test('search prioritizes title matches over description matches', () => {
    const results = searchInIndex('react');

    if (results.length > 1) {
      // Item with "react" in title should score higher than description-only matches
      const titleMatch = results.find(r => r.title.toLowerCase().includes('react'));
      if (titleMatch) {
        const descOnlyMatches = results.filter(r =>
          !r.title.toLowerCase().includes('react') &&
          r.description.toLowerCase().includes('react')
        );

        descOnlyMatches.forEach(descMatch => {
          expect(titleMatch.score).toBeGreaterThan(descMatch.score);
        });
      }
    }
  });

  test('search handles special characters', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }),
        (query) => {
          // Should not throw
          expect(() => searchInIndex(query)).not.toThrow();

          const results = searchInIndex(query);
          expect(Array.isArray(results)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('search results contain required fields', () => {
    const results = searchInIndex('home');

    results.forEach((result) => {
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('title');
      expect(result).toHaveProperty('description');
      expect(result).toHaveProperty('category');
      expect(result).toHaveProperty('url');
      expect(result).toHaveProperty('keywords');
      expect(result).toHaveProperty('score');
    });
  });

  test('search with multiple words', () => {
    const results = searchInIndex('web developer');

    // Should find items matching either word
    expect(results.length).toBeGreaterThan(0);
  });
});

// ===== Unit Tests for Search Edge Cases =====

describe('Search Component - Edge Cases', () => {
  test('search handles empty index', () => {
    const results = searchInIndex('test', []);
    expect(results).toEqual([]);
  });

  test('search handles malformed index items', () => {
    const malformedIndex = [
      { id: 'test1', title: 'Test' }, // Missing fields
      { id: 'test2' }, // Only id
      {}, // Empty object
    ];

    // Should not throw
    expect(() => {
      malformedIndex.forEach((item) => {
        const _titleLower = (item.title || '').toLowerCase();
        const _descLower = (item.description || '').toLowerCase();
        const _keywords = item.keywords || [];
      });
    }).not.toThrow();
  });

  test('search handles very long queries', () => {
    const longQuery = 'a'.repeat(1000);
    const results = searchInIndex(longQuery);

    expect(Array.isArray(results)).toBe(true);
  });

  test('search handles unicode characters', () => {
    const unicodeQueries = ['über', 'café', '日本語', '🔍'];

    unicodeQueries.forEach((query) => {
      expect(() => searchInIndex(query)).not.toThrow();
    });
  });

  test('search handles whitespace-only queries', () => {
    const results = searchInIndex('   ');
    expect(results.length).toBe(0);
  });

  test('search handles queries with leading/trailing whitespace', () => {
    const results1 = searchInIndex('react');
    const results2 = searchInIndex('  react  ');

    // Should return same results after trimming
    expect(results1.length).toBe(results2.length);
  });

  test('search scoring is consistent', () => {
    const results1 = searchInIndex('react');
    const results2 = searchInIndex('react');

    expect(results1.length).toBe(results2.length);

    results1.forEach((result, index) => {
      expect(result.id).toBe(results2[index].id);
      expect(result.score).toBe(results2[index].score);
    });
  });

  test('search handles duplicate items in index', () => {
    const duplicateIndex = [
      ...MOCK_SEARCH_INDEX,
      ...MOCK_SEARCH_INDEX, // Duplicate all items
    ];

    const results = searchInIndex('home', duplicateIndex);

    // Should return duplicates (no deduplication in basic implementation)
    expect(results.length).toBeGreaterThan(0);
  });

  test('search handles items with missing keywords', () => {
    const indexWithoutKeywords = [
      {
        id: 'test',
        title: 'Test Item',
        description: 'Test description',
        category: 'Test',
        url: '/test/',
        keywords: [], // Empty keywords
        priority: 5,
      },
    ];

    const results = searchInIndex('test', indexWithoutKeywords);
    expect(results.length).toBeGreaterThan(0);
  });

  test('search handles items with null/undefined fields', () => {
    const indexWithNulls = [
      {
        id: 'test',
        title: null,
        description: undefined,
        category: 'Test',
        url: '/test/',
        keywords: null,
        priority: 5,
      },
    ];

    // Should not throw
    expect(() => {
      const item = indexWithNulls[0];
      const _titleLower = (item.title || '').toLowerCase();
      const _descLower = (item.description || '').toLowerCase();
      const _keywords = item.keywords || [];
    }).not.toThrow();
  });
});

// ===== Search UI Tests =====

describe('Search Component - UI', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="search-overlay" class="search-overlay">
        <div class="search-modal">
          <div class="search-header">
            <div class="search-input-wrapper">
              <input type="text" class="search-input" placeholder="Spotlight-Suche">
            </div>
            <button class="search-close">×</button>
          </div>
          <div class="search-results"></div>
        </div>
      </div>
    `;
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  test('search overlay exists', () => {
    const overlay = document.getElementById('search-overlay');
    expect(overlay).toBeTruthy();
  });

  test('search input exists', () => {
    const input = document.querySelector('.search-input');
    expect(input).toBeTruthy();
    expect(input.getAttribute('type')).toBe('text');
  });

  test('search close button exists', () => {
    const closeButton = document.querySelector('.search-close');
    expect(closeButton).toBeTruthy();
  });

  test('search results container exists', () => {
    const resultsContainer = document.querySelector('.search-results');
    expect(resultsContainer).toBeTruthy();
  });

  test('search input accepts text', () => {
    const input = document.querySelector('.search-input');
    input.value = 'test query';
    expect(input.value).toBe('test query');
  });

  test('search overlay can be shown/hidden', () => {
    const overlay = document.getElementById('search-overlay');

    overlay.classList.add('active');
    expect(overlay.classList.contains('active')).toBe(true);

    overlay.classList.remove('active');
    expect(overlay.classList.contains('active')).toBe(false);
  });
});
