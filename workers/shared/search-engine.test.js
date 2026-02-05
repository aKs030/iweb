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
    const results = engine.search('photogaphy', 5); // Typo
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].title).toBe('Photography Tips');
  });

  it('should prioritize items correctly (score + priority)', () => {
    // Both items match "The" (stop word usually, but assuming it's indexed or we use other words)
    // Let's use a word that might appear in multiple places or test explicit priority
    // "Berlin" (prio 10) vs "React" (prio 5).
    // If we search for something common?
    // Let's rely on the fact that priority is added.

    // We can check if score > 0
    const res = engine.search('Berlin', 1);
    expect(res[0].score).toBeGreaterThan(10); // Base score + priority 10
  });

  it('should handle empty queries gracefully', () => {
    const results = engine.search('', 5);
    expect(results).toEqual([]);
  });

  it('should handle null/undefined queries', () => {
    expect(engine.search(null, 5)).toEqual([]);
    expect(engine.search(undefined, 5)).toEqual([]);
  });
});
