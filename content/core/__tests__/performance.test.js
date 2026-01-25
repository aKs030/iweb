/**
 * Tests for performance.js
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  mark,
  measure,
  getNavigationTiming,
  getMemoryUsage,
  clearMetrics,
} from '../performance.js';

describe('Performance', () => {
  beforeEach(() => {
    clearMetrics();
  });

  describe('mark', () => {
    it('should create a performance mark', () => {
      mark('test-mark');
      const marks = performance.getEntriesByName('test-mark', 'mark');
      expect(marks.length).toBeGreaterThan(0);
    });
  });

  describe('measure', () => {
    it('should measure between two marks', () => {
      mark('start');
      mark('end');
      const duration = measure('test-measure', 'start', 'end');
      expect(duration).toBeGreaterThanOrEqual(0);
    });

    it('should measure from mark to now', () => {
      mark('start');
      const duration = measure('test-measure', 'start');
      expect(duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getNavigationTiming', () => {
    it('should return navigation timing object', () => {
      const timing = getNavigationTiming();
      expect(timing).toBeDefined();
    });
  });

  describe('getMemoryUsage', () => {
    it('should return memory usage or null', () => {
      const memory = getMemoryUsage();
      // Memory API is Chrome-only
      expect(memory === null || typeof memory === 'object').toBe(true);
    });
  });
});
