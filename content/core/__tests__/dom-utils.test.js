import { describe, it, expect, vi } from 'vitest';
import { debounce, throttle } from '../dom-utils.js';

describe('dom-utils', () => {
  describe('debounce', () => {
    it('should debounce a function', async () => {
      const fn = vi.fn();
      const debouncedFn = debounce(fn, 100);

      debouncedFn();
      debouncedFn();
      debouncedFn();

      expect(fn).not.toHaveBeenCalled();

      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('throttle', () => {
    it('should throttle a function', async () => {
      const fn = vi.fn();
      const throttledFn = throttle(fn, 100);

      throttledFn();
      throttledFn();
      throttledFn();

      expect(fn).toHaveBeenCalledTimes(1);

      await new Promise((resolve) => setTimeout(resolve, 150));

      // Throttle usually runs at start, then blocks.
      // My implementation:
      /*
        if (!inThrottle) {
          func.apply(this, args);
          inThrottle = true;
          setTimeout(() => (inThrottle = false), limit);
        }
      */
      // So it fires immediately, then ignores subsequent calls until timeout clears.

      throttledFn();
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });
});
