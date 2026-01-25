/**
 * Tests for fetch.js
 * Run with: npm test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  fetchWithRetry,
  fetchJSON,
  fetchText,
  clearCache,
  getCacheStats,
} from '../fetch.js';

describe('fetchWithRetry', () => {
  beforeEach(() => {
    clearCache();
    global.fetch = vi.fn();
  });

  it('should fetch successfully on first attempt', async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({ data: 'test' }),
      clone: () => mockResponse,
    };

    global.fetch.mockResolvedValueOnce(mockResponse);

    const response = await fetchWithRetry('https://example.com/api');
    expect(response.ok).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('should retry on failure', async () => {
    const mockError = new Error('Network error');
    const mockResponse = { ok: true, clone: () => mockResponse };

    global.fetch
      .mockRejectedValueOnce(mockError)
      .mockRejectedValueOnce(mockError)
      .mockResolvedValueOnce(mockResponse);

    const response = await fetchWithRetry('https://example.com/api', {
      retries: 3,
      retryDelay: 10,
    });

    expect(response.ok).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it('should cache responses when enabled', async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({ data: 'test' }),
      clone: () => mockResponse,
    };

    global.fetch.mockResolvedValue(mockResponse);

    await fetchWithRetry('https://example.com/api', { cache: true });
    await fetchWithRetry('https://example.com/api', { cache: true });

    expect(global.fetch).toHaveBeenCalledTimes(1);

    const stats = getCacheStats();
    expect(stats.size).toBe(1);
  });

  it('should timeout after specified duration', async () => {
    global.fetch.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve({ ok: true }), 1000);
        }),
    );

    await expect(
      fetchWithRetry('https://example.com/api', {
        timeout: 100,
        retries: 0,
      }),
    ).rejects.toThrow();
  });
});

describe('fetchJSON', () => {
  it('should parse JSON response', async () => {
    const mockData = { name: 'Test', value: 123 };
    const mockResponse = {
      ok: true,
      json: async () => mockData,
      clone: () => mockResponse,
    };

    global.fetch = vi.fn().mockResolvedValue(mockResponse);

    const data = await fetchJSON('https://example.com/api');
    expect(data).toEqual(mockData);
  });
});

describe('fetchText', () => {
  it('should return text response', async () => {
    const mockText = 'Hello World';
    const mockResponse = {
      ok: true,
      text: async () => mockText,
      clone: () => mockResponse,
    };

    global.fetch = vi.fn().mockResolvedValue(mockResponse);

    const text = await fetchText('https://example.com/api');
    expect(text).toBe(mockText);
  });
});
