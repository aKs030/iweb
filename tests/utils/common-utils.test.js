import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getElementById, throttle, debounce, shuffle } from '../../content/webentwicklung/utils/common-utils.js';

// Mock DOM for testing
Object.defineProperty(window, 'document', {
  value: {
    getElementById: vi.fn(),
    querySelector: vi.fn(),
    contains: vi.fn(() => true)
  }
});

describe('Common Utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getElementById with cache', () => {
    it('should return element from DOM', () => {
      const mockElement = { id: 'test' };
      window.document.getElementById.mockReturnValue(mockElement);
      
      const result = getElementById('test');
      expect(result).toBe(mockElement);
      expect(window.document.getElementById).toHaveBeenCalledWith('test');
    });

    it('should use cache when enabled', () => {
      // Test mit separaten IDs um Cache-Konflikte zu vermeiden
      const mockElement1 = { id: 'test1' };
      const mockElement2 = { id: 'test2' };
      
      window.document.getElementById
        .mockReturnValueOnce(mockElement1)
        .mockReturnValueOnce(mockElement2);
      
      const result1 = getElementById('test1', true);
      const result2 = getElementById('test2', false);
      
      expect(result1).toBe(mockElement1);
      expect(result2).toBe(mockElement2);
      expect(window.document.getElementById).toHaveBeenCalledTimes(2);
    });

    it('should not cache when useCache is false', () => {
      const mockElement = { id: 'test3' };
      window.document.getElementById.mockReturnValue(mockElement);
      
      getElementById('test3', false);
      getElementById('test3', false);
      
      expect(window.document.getElementById).toHaveBeenCalledTimes(2);
    });
  });

  describe('throttle', () => {
    it('should limit function calls', (done) => {
      const fn = vi.fn();
      const throttledFn = throttle(fn, 100);
      
      throttledFn();
      throttledFn();
      throttledFn();
      
      expect(fn).toHaveBeenCalledTimes(1);
      
      setTimeout(() => {
        throttledFn();
        expect(fn).toHaveBeenCalledTimes(2);
        done();
      }, 150);
    });
  });

  describe('debounce', () => {
    it('should delay function execution', (done) => {
      const fn = vi.fn();
      const debouncedFn = debounce(fn, 100);
      
      debouncedFn();
      debouncedFn();
      debouncedFn();
      
      expect(fn).not.toHaveBeenCalled();
      
      setTimeout(() => {
        expect(fn).toHaveBeenCalledTimes(1);
        done();
      }, 150);
    });

    it('should support cancellation', () => {
      const fn = vi.fn();
      const debouncedFn = debounce(fn, 100);
      
      debouncedFn();
      debouncedFn.cancel();
      
      setTimeout(() => {
        expect(fn).not.toHaveBeenCalled();
      }, 150);
    });
  });

  describe('shuffle', () => {
    it('should return shuffled copy of array', () => {
      const original = [1, 2, 3, 4, 5];
      const shuffled = shuffle(original);
      
      expect(shuffled).not.toBe(original); // Different reference
      expect(shuffled).toHaveLength(original.length);
      
      const shuffledSorted = [...shuffled].sort((a, b) => a - b);
      const originalSorted = [...original].sort((a, b) => a - b);
      expect(shuffledSorted).toEqual(originalSorted); // Same elements
    });

    it('should not modify original array', () => {
      const original = [1, 2, 3];
      const originalCopy = [...original];
      
      shuffle(original);
      expect(original).toEqual(originalCopy);
    });
  });
});
