import { describe, it, expect, vi } from 'vitest';
import { performSearch } from './search-utils.js';

describe('performSearch (D1)', () => {
  it('should return empty array if no query', async () => {
    const results = await performSearch('', 10, { DB: {} });
    expect(results).toEqual([]);
  });

  it('should return empty array if no DB in env', async () => {
    const results = await performSearch('query', 10, {});
    expect(results).toEqual([]);
  });

  it('should execute SQL query with correct params', async () => {
    const mockAll = vi.fn().mockResolvedValue({
      results: [
        {
          id: '1',
          title: 'Test',
          description: 'Desc',
          url: '/test',
          category: 'Page',
          rank: -5.1,
        },
      ],
    });
    const mockBind = vi.fn().mockReturnValue({ all: mockAll });
    const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
    const mockEnv = { DB: { prepare: mockPrepare } };

    const results = await performSearch('hello world', 5, mockEnv, true);

    // Check SQL preparation
    expect(mockPrepare).toHaveBeenCalledWith(
      expect.stringContaining(
        'SELECT id, title, description, url, category, rank',
      ),
    );
    expect(mockPrepare).toHaveBeenCalledWith(
      expect.stringContaining('FROM search_index'),
    );
    expect(mockPrepare).toHaveBeenCalledWith(
      expect.stringContaining('WHERE search_index MATCH ?'),
    );

    // Check binding: "hello"* AND "world"*
    // Note: The implementation splits by space and joins with AND.
    // "hello world" -> ["hello", "world"] -> "\"hello\"* AND \"world\"*"
    const expectedQuery = '"hello"* AND "world"*';
    expect(mockBind).toHaveBeenCalledWith(expectedQuery, 5);

    // Check results mapping
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      id: '1',
      title: 'Test',
      description: 'Desc',
      url: '/test',
      score: -5.1,
    });
  });

  it('should handle single token query', async () => {
    const mockAll = vi.fn().mockResolvedValue({ results: [] });
    const mockBind = vi.fn().mockReturnValue({ all: mockAll });
    const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
    const mockEnv = { DB: { prepare: mockPrepare } };

    await performSearch('test', 10, mockEnv);

    expect(mockBind).toHaveBeenCalledWith('"test"*', 10);
  });
});
