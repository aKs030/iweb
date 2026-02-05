import { describe, it, expect, beforeEach } from 'vitest';
import { SearchEngine } from './search-engine.js';

describe('SearchEngine (MiniSearch)', () => {
  const mockItems = [
    {
      id: '1',
      title: 'Berlin Weather',
      description: 'The weather in Berlin is cold.',
      url: '/weather',
      priority: 10,
      keywords: ['weather', 'forecast'],
    },
    {
      id: '2',
      title: 'React Tutorial',
      description: 'Learn React from scratch.',
      url: '/react',
      priority: 5,
      keywords: ['react', 'js', 'javascript'],
    },
    {
      id: '3',
      title: 'Photography Tips',
      description: 'How to take good photos.',
      url: '/photo',
      priority: 8,
      keywords: ['photo', 'camera'],
    },
  ];

  let engine;

  beforeEach(() => {
    engine = new SearchEngine(mockItems);
  });

  it('should find exact matches in title', () => {
    const results = engine.search('Berlin', 5);
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('1');
    expect(results[0].title).toBe('Berlin Weather');
  });

  it('should be case-insensitive', () => {
    const results = engine.search('BERLIN', 5);
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('1');
  });

  it('should find matches in description', () => {
    const results = engine.search('cold', 5);
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('1');
  });

  it('should find matches in keywords', () => {
    const results = engine.search('javascript', 5);
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('2');
  });

  it('should support prefix search', () => {
    const results = engine.search('Ber', 5);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].title).toContain('Berlin');
  });

  it('should support fuzzy search (typos)', () => {
    const results = engine.search('photgraphy', 5); // Single-character typo (missing 'o')
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].title).toBe('Photography Tips');
  });

  it('should prioritize items correctly (score + priority)', () => {
    // Use a separate SearchEngine instance with two otherwise identical items
    // that differ only by priority. The higher-priority item should rank higher
    // and have a higher score when searching for a matching term.
    const localItems = [
      {
        id: 'high',
        title: 'Common Term Article',
        description: 'An article about a common term.',
        url: '/high',
        priority: 10,
        keywords: ['common'],
      },
      {
        id: 'low',
        title: 'Common Term Article',
        description: 'An article about a common term.',
        url: '/low',
        priority: 1,
        keywords: ['common'],
      },
    ];

    const localEngine = new SearchEngine(localItems);
    const res = localEngine.search('common', 2);

    expect(res).toHaveLength(2);
    expect(res[0].id).toBe('high');
    expect(res[1].id).toBe('low');
    expect(res[0].score).toBeGreaterThan(res[1].score);
  });

  it('should handle empty queries gracefully', () => {
    const results = engine.search('', 5);
    expect(results).toEqual([]);
  });

  it('should handle null/undefined queries', () => {
    expect(engine.search(null, 5)).toEqual([]);
    expect(engine.search(undefined, 5)).toEqual([]);
  });

  it('should perform case-insensitive search', () => {
    const resultsLower = engine.search('berlin', 5);
    const resultsUpper = engine.search('BERLIN', 5);
    const resultsMixed = engine.search('BeRLiN', 5);

    expect(resultsLower).toHaveLength(1);
    expect(resultsUpper).toHaveLength(1);
    expect(resultsMixed).toHaveLength(1);

    expect(resultsLower[0].id).toBe('1');
    expect(resultsUpper[0].id).toBe('1');
    expect(resultsMixed[0].id).toBe('1');
  });
});
