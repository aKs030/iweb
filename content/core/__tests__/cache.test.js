/**
 * Tests for cache.js
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getCache, cached, MemoryCache } from '../cache.js';

describe('MemoryCache', () => {
  let cache;

  beforeEach(() => {
    cache = new MemoryCache(10);
  });

  it('should store and retrieve values', () => {
    cache.set('key1', 'value1');
    expect(cache.get('key1')).toBe('value1');
  });

  it('should return null for missing keys', () => {
    expect(cache.get('missing')).toBeNull();
  });

  it('should expire values after TTL', async () => {
    cache.set('key1', 'value1', 100);
    expect(cache.get('key1')).toBe('value1');

    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(cache.get('key1')).toBeNull();
  });

  it('should evict oldest entry when full', () => {
    for (let i = 0; i < 11; i++) {
      cache.set(`key${i}`, `value${i}`);
    }

    expect(cache.size).toBe(10);
    expect(cache.get('key0')).toBeNull();
    expect(cache.get('key10')).toBe('value10');
  });

  it('should clear all entries', () => {
    cache.set('key1', 'value1');
    cache.set('key2', 'value2');
    cache.clear();

    expect(cache.size).toBe(0);
    expect(cache.get('key1')).toBeNull();
  });
});

describe('CacheManager', () => {
  let cache;

  beforeEach(() => {
    cache = getCache({ useIndexedDB: false });
    cache.clear();
  });

  it('should store and retrieve values', async () => {
    await cache.set('key1', 'value1');
    const value = await cache.get('key1');
    expect(value).toBe('value1');
  });

  it('should return null for missing keys', async () => {
    const value = await cache.get('missing');
    expect(value).toBeNull();
  });

  it('should delete values', async () => {
    await cache.set('key1', 'value1');
    await cache.delete('key1');
    const value = await cache.get('key1');
    expect(value).toBeNull();
  });
});

describe('cached decorator', () => {
  beforeEach(() => {
    getCache().clear();
  });

  it('should cache function results', async () => {
    let callCount = 0;

    const fn = cached(async (x) => {
      callCount++;
      return x * 2;
    });

    const result1 = await fn(5);
    const result2 = await fn(5);

    expect(result1).toBe(10);
    expect(result2).toBe(10);
    expect(callCount).toBe(1);
  });

  it('should cache different arguments separately', async () => {
    let callCount = 0;

    const fn = cached(async (x) => {
      callCount++;
      return x * 2;
    });

    await fn(5);
    await fn(10);

    expect(callCount).toBe(2);
  });
});
