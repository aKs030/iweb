import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calculateRelevanceScore } from './_search-scoring.js';

describe('calculateRelevanceScore', () => {
  it('calculates score based on simple match', () => {
    const result = {
      title: 'Test Page',
      url: '/test-page',
      description: 'This is a test description',
      score: 10,
    };
    const query = 'test';
    const score = calculateRelevanceScore(result, query);
    assert.ok(score > 10);
  });

  it('calculates score for partial matches', () => {
    const result = {
      title: 'Performance Optimization',
      url: '/perf-opt',
      description: 'Making code run faster',
      score: 0,
    };
    const query = 'performance code';
    const score = calculateRelevanceScore(result, query);
    assert.ok(score > 0);
  });

  it('handles empty query', () => {
    const result = { title: 'Foo', url: '/foo', score: 5 };
    const score = calculateRelevanceScore(result, '');
    assert.ok(score > 0);
  });
});
